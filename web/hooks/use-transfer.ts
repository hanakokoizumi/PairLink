"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { generateTransferId } from "@/lib/webrtc/datachannel";
import {
  CHUNK_SIZE,
  type ChatPayload,
  type FileMetaPayload,
  type FileCancelPayload,
  sha256Hex,
  validateFileSize,
} from "@/lib/webrtc/file-transfer";
import { encryptText, decryptText } from "@/lib/crypto/session";
import { sanitizeDownloadFilename } from "@/lib/utils";
import {
  appendChunk,
  assembleBlob,
  deleteResumeRecord,
  getResumeRecord,
  saveResumeRecord,
} from "@/lib/storage/resume-store";
import { useConfigStore } from "@/lib/stores/config-store";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { useTransferStore } from "@/lib/stores/transfer-store";
import type { SignalingState } from "@/hooks/use-signaling";

type Transport = {
  send: (type: string, payload?: unknown) => void | Promise<void>;
  sendBinary: (
    transferId: string,
    offset: number,
    chunk: ArrayBuffer,
  ) => void | Promise<void>;
};

function getTransport(signaling: SignalingState): Transport | null {
  if (signaling.dataChannel && signaling.dataChannel.readyState === "open") {
    return {
      send: (type, payload) => signaling.dataChannel!.send(type, payload),
      sendBinary: (id, offset, chunk) =>
        signaling.dataChannel!.sendBinary(id, offset, chunk),
    };
  }
  if (signaling.relay) {
    return {
      send: (type, payload) => signaling.relay!.send(type, payload),
      sendBinary: (id, offset, chunk) =>
        signaling.relay!.sendBinary(id, offset, chunk),
    };
  }
  return null;
}

export function useTransfer(signaling: SignalingState, roomId: string) {
  const t = useTranslations();
  const settings = useConfigStore((s) => s.config?.settings);
  const addItem = useTransferStore((s) => s.addItem);
  const updateItem = useTransferStore((s) => s.updateItem);
  const updateProgress = useTransferStore((s) => s.updateProgress);
  const acceptFile = useTransferStore((s) => s.acceptFile);
  const rejectFile = useTransferStore((s) => s.rejectFile);
  const addActivity = useTransferStore((s) => s.addActivity);
  const transferWaiters = useRef(
    new Map<string, (accepted: boolean) => void>(),
  );
  const cancelledTransfersRef = useRef(new Set<string>());
  const chunkChains = useRef(new Map<string, Promise<void>>());
  const autoDownloaded = useRef(new Set<string>());

  const triggerRecvDownload = useCallback((id: string) => {
    if (autoDownloaded.current.has(id)) return;
    const item = useTransferStore.getState().items.find((i) => i.id === id);
    if (!item || item.kind !== "file" || item.direction !== "recv") return;
    if (item.size > 0 && !item.blob) return;
    autoDownloaded.current.add(id);
    const blob = item.blob ?? new Blob([], { type: item.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sanitizeDownloadFilename(item.name);
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const waitForTransferResponse = useCallback((transferId: string) => {
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        transferWaiters.current.delete(transferId);
        resolve(false);
      }, 30_000);
      transferWaiters.current.set(transferId, (accepted) => {
        clearTimeout(timer);
        transferWaiters.current.delete(transferId);
        resolve(accepted);
      });
    });
  }, []);

  const handleTransferResponse = useCallback(
    (payload: { id: string; accepted: boolean }) => {
      transferWaiters.current.get(payload.id)?.(payload.accepted);
    },
    [],
  );

  const isCancelled = useCallback(
    (id: string) => cancelledTransfersRef.current.has(id),
    [],
  );

  const cancelFile = useCallback(
    (id: string) => {
      const item = useTransferStore.getState().items.find((i) => i.id === id);
      if (!item || item.kind !== "file") return;
      if (
        item.status !== "transferring" &&
        item.status !== "resuming" &&
        item.status !== "awaiting_accept"
      ) {
        return;
      }

      cancelledTransfersRef.current.add(id);
      transferWaiters.current.get(id)?.(false);
      transportSend(signaling, "file-cancel", { id });
      updateItem(id, { status: "interrupted" });
      chunkChains.current.delete(id);
      addActivity(`Cancelled ${item.name}`, "warn");
    },
    [addActivity, signaling, updateItem],
  );

  const handleFileCancel = useCallback(
    (payload: FileCancelPayload) => {
      cancelledTransfersRef.current.add(payload.id);
      transferWaiters.current.get(payload.id)?.(false);
      const item = useTransferStore
        .getState()
        .items.find((i) => i.id === payload.id);
      if (!item || item.kind !== "file") return;
      if (
        item.status === "done" ||
        item.status === "rejected" ||
        item.status === "interrupted"
      ) {
        return;
      }
      updateItem(payload.id, { status: "interrupted" });
      addActivity(`Transfer cancelled: ${item.name}`, "warn");
    },
    [addActivity, updateItem],
  );

  const sendMessage = useCallback(
    async (text: string, masked = false) => {
      const transport = getTransport(signaling);
      if (!transport || !settings) return;
      if (text.length > settings.messageMaxLength) {
        toast.error(t("errors.messageTooLong"));
        return;
      }
      const id = generateTransferId();
      const at = Date.now();
      let payload: ChatPayload;
      if (masked) {
        if (!signaling.sessionKey) {
          toast.error(t("errors.encryptionNotReady"));
          return;
        }
        const textEnc = await encryptText(signaling.sessionKey, text);
        payload = {
          id,
          at,
          masked: true,
          format: "markdown",
          textEnc,
        };
      } else {
        payload = {
          id,
          text,
          at,
          masked: false,
          format: "markdown",
        };
      }
      transport.send("chat", payload);
      addItem({
        kind: "message",
        id: payload.id,
        direction: "send",
        text,
        at: payload.at,
        format: "markdown",
        masked,
        revealed: !masked,
      });
      addActivity("Message sent");
    },
    [addActivity, addItem, settings, signaling, t],
  );

  const sendFiles = useCallback(
    async (files: FileList | File[]) => {
      const transport = getTransport(signaling);
      if (!transport || !settings) return;
      const list = Array.from(files);

      for (const file of list) {
        if (!validateFileSize(file.size, settings.fileMaxSizeBytes)) {
          toast.error(t("errors.fileTooLarge"));
          continue;
        }
        const id = generateTransferId();
        addItem({
          kind: "file",
          id,
          direction: "send",
          name: file.name,
          size: file.size,
          mime: file.type || "application/octet-stream",
          status: "transferring",
          progress: 0,
          receivedBytes: 0,
          file,
        });

        const meta: FileMetaPayload = {
          id,
          name: file.name,
          size: file.size,
          mime: file.type || "application/octet-stream",
          resume: settings.resumeTransferEnabled,
        };
        transport.send("file-meta", meta);

        const accepted = await waitForTransferResponse(id);
        if (!accepted || isCancelled(id)) {
          updateItem(id, {
            status: isCancelled(id) ? "interrupted" : "rejected",
          });
          if (!isCancelled(id)) {
            addActivity(`Transfer declined: ${file.name}`, "warn");
          }
          continue;
        }

        let offset = 0;
        const sha256 = await sha256Hex(file);
        while (offset < file.size) {
          if (isCancelled(id)) break;
          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const buffer = await slice.arrayBuffer();
          if (isCancelled(id)) break;
          await transport.sendBinary(id, offset, buffer);
          offset += buffer.byteLength;
          updateProgress(id, offset, file.size);
        }
        if (isCancelled(id)) {
          updateItem(id, { status: "interrupted" });
          continue;
        }
        transport.send("file-complete", { id, ...(sha256 ? { sha256 } : {}) });
        cancelledTransfersRef.current.delete(id);
        updateItem(id, { status: "done", progress: 100 });
        addActivity(`Sent ${file.name}`);
      }
    },
    [addActivity, addItem, isCancelled, settings, signaling, t, updateItem, updateProgress, waitForTransferResponse],
  );

  const downloadFile = useCallback((id: string) => {
    const item = useTransferStore.getState().items.find((i) => i.id === id);
    if (!item || item.kind !== "file" || !item.blob) return;
    const url = URL.createObjectURL(item.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sanitizeDownloadFilename(item.name);
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const resumeFile = useCallback(
    async (id: string) => {
      const item = useTransferStore.getState().items.find((i) => i.id === id);
      if (!item || item.kind !== "file") return;
      const transport = getTransport(signaling);
      if (!transport) return;
      cancelledTransfersRef.current.delete(id);
      transport.send("file-resume-query", { id });
      updateItem(id, { status: "resuming" });
      addActivity(`Resuming ${item.name}`);
    },
    [addActivity, signaling, updateItem],
  );

  const handleIncomingMeta = useCallback(
    (meta: FileMetaPayload) => {
      if (
        settings &&
        !validateFileSize(meta.size, settings.fileMaxSizeBytes)
      ) {
        transportSend(signaling, "files-transfer-response", {
          id: meta.id,
          accepted: false,
        });
        addActivity(`Rejected oversized file: ${meta.name}`, "warn");
        return;
      }
      const autoAccept = usePreferencesStore
        .getState()
        .getAutoAcceptFiles(settings?.autoAcceptFiles);
      if (useTransferStore.getState().items.some((i) => i.id === meta.id)) {
        return;
      }
      addItem({
        kind: "file",
        id: meta.id,
        direction: "recv",
        name: meta.name,
        size: meta.size,
        mime: meta.mime,
        status: autoAccept ? "transferring" : "awaiting_accept",
        progress: 0,
        receivedBytes: 0,
      });
      if (autoAccept) {
        transportSend(signaling, "files-transfer-response", { id: meta.id, accepted: true });
      }
    },
    [addItem, addActivity, settings, signaling],
  );

  const handleIncomingChat = useCallback(
    async (chat: ChatPayload) => {
      let text = chat.text ?? "";
      if (chat.masked) {
        if (chat.textEnc) {
          if (!signaling.sessionKey) {
            addActivity("Cannot decrypt masked message", "warn");
            return;
          }
          try {
            text = await decryptText(signaling.sessionKey, chat.textEnc);
          } catch {
            addActivity("Failed to decrypt masked message", "error");
            return;
          }
        } else {
          addActivity("Rejected invalid masked message", "warn");
          return;
        }
      }
      if (
        settings &&
        text.length > settings.messageMaxLength
      ) {
        addActivity("Rejected oversized message", "warn");
        return;
      }
      addItem({
        kind: "message",
        id: chat.id,
        direction: "recv",
        text,
        at: chat.at,
        format: chat.format ?? "markdown",
        masked: chat.masked,
        revealed: !chat.masked,
      });
    },
    [addActivity, addItem, settings, signaling.sessionKey],
  );

  const onAcceptFile = useCallback(
    (id: string) => {
      acceptFile(id);
      transportSend(signaling, "files-transfer-response", { id, accepted: true });
    },
    [acceptFile, signaling],
  );

  const onRejectFile = useCallback(
    (id: string) => {
      rejectFile(id);
      transportSend(signaling, "files-transfer-response", { id, accepted: false });
    },
    [rejectFile, signaling],
  );

  const handleResumeQuery = useCallback(
    async (transferId: string) => {
      const record = await getResumeRecord(transferId);
      const item = useTransferStore.getState().items.find((i) => i.id === transferId);
      const raw =
        record?.receivedBytes ?? (item?.kind === "file" ? item.receivedBytes : 0);
      const maxSize = item?.kind === "file" ? item.size : 0;
      const receivedBytes = Math.max(0, Math.min(raw, maxSize));
      transportSend(signaling, "file-resume-state", { id: transferId, receivedBytes });
    },
    [signaling],
  );

  const handleResumeState = useCallback(
    async (payload: { id: string; receivedBytes: number }) => {
      const item = useTransferStore.getState().items.find((i) => i.id === payload.id);
      if (!item || item.kind !== "file" || !item.file) return;
      const transport = getTransport(signaling);
      if (!transport) return;

      let offset = Math.max(0, Math.min(payload.receivedBytes, item.size));
      updateItem(payload.id, { status: "transferring" });
      while (offset < item.size) {
        if (isCancelled(payload.id)) break;
        const slice = item.file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();
        if (isCancelled(payload.id)) break;
        await transport.sendBinary(payload.id, offset, buffer);
        offset += buffer.byteLength;
        updateProgress(payload.id, offset, item.size);
      }
      if (isCancelled(payload.id)) {
        updateItem(payload.id, { status: "interrupted" });
        return;
      }
      const sha256 = await sha256Hex(item.file);
      transport.send("file-complete", {
        id: payload.id,
        ...(sha256 ? { sha256 } : {}),
      });
      cancelledTransfersRef.current.delete(payload.id);
      chunkChains.current.delete(payload.id);
      updateItem(payload.id, { status: "done", progress: 100 });
      addActivity(`Resumed ${item.name}`);
    },
    [addActivity, isCancelled, signaling, updateItem, updateProgress],
  );

  const handleFileComplete = useCallback(
    async (payload: { id: string; sha256?: string }) => {
      const item = useTransferStore.getState().items.find((i) => i.id === payload.id);
      if (!item || item.kind !== "file") return;

      if (item.blob) {
        if (payload.sha256) {
          const actual = await sha256Hex(item.blob);
          if (actual !== payload.sha256) {
            addActivity(`Checksum failed: ${item.name}`, "error");
            updateItem(payload.id, { status: "interrupted" });
            return;
          }
        }
        if (item.status === "done") return;
      }

      if (item.size !== 0 || item.status === "done") return;

      updateItem(payload.id, {
        blob: new Blob([], { type: item.mime }),
        status: "done",
        progress: 100,
        receivedBytes: 0,
      });
      await deleteResumeRecord(payload.id);
      addActivity(`Received ${item.name}`);
      triggerRecvDownload(payload.id);
    },
    [addActivity, triggerRecvDownload, updateItem],
  );

  const handleChunk = useCallback(
    async (transferId: string, offset: number, payload: ArrayBuffer) => {
      const run = async () => {
        const item = useTransferStore.getState().items.find((i) => i.id === transferId);
        if (!item || item.kind !== "file") return;
        if (item.status === "awaiting_accept" || item.status === "rejected") return;
        if (item.status === "interrupted" || isCancelled(transferId)) return;
        if (offset !== item.receivedBytes) return;

        const receivedBytes = offset + payload.byteLength;
        const existing = await getResumeRecord(transferId);
        if (existing) {
          await appendChunk(transferId, payload, receivedBytes);
        } else {
          await saveResumeRecord({
            transferId,
            roomId,
            name: item.name,
            size: item.size,
            mime: item.mime,
            receivedBytes,
            chunks: [payload],
            direction: "recv",
            updatedAt: Date.now(),
          });
        }
        updateProgress(transferId, receivedBytes, item.size);
        if (receivedBytes >= item.size) {
          const record = await getResumeRecord(transferId);
          if (record) {
            const blob = assembleBlob(record);
            updateItem(transferId, { blob, status: "done", progress: 100 });
            await deleteResumeRecord(transferId);
            chunkChains.current.delete(transferId);
            addActivity(`Received ${item.name}`);
            triggerRecvDownload(transferId);
          }
        }
      };

      const prev = chunkChains.current.get(transferId) ?? Promise.resolve();
      const next = prev.then(run);
      chunkChains.current.set(transferId, next);
      await next;
    },
    [addActivity, isCancelled, roomId, triggerRecvDownload, updateItem, updateProgress],
  );

  return {
    sendMessage,
    sendFiles,
    downloadFile,
    resumeFile,
    cancelFile,
    handleIncomingMeta,
    handleIncomingChat,
    onAcceptFile,
    onRejectFile,
    handleChunk,
    handleResumeQuery,
    handleResumeState,
    handleTransferResponse,
    handleFileComplete,
    handleFileCancel,
  };
}

function transportSend(
  signaling: SignalingState,
  type: string,
  payload?: unknown,
) {
  const transport = getTransport(signaling);
  transport?.send(type, payload);
}
