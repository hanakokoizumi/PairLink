"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { generateTransferId } from "@/lib/webrtc/datachannel";
import {
  chunkSizeForTransport,
  type ChatPayload,
  type FileMetaPayload,
  type FileCancelPayload,
  type FileAckPayload,
  inFlightWindowBytes,
  sha256Hex,
  shouldSendAck,
  validateFileSize,
} from "@/lib/webrtc/file-transfer";
import { getActiveTransport } from "@/lib/webrtc/transport";
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

function getTransport(signaling: SignalingState) {
  const connectionMode = useTransferStore.getState().connectionMode;
  const transport = getActiveTransport(signaling, connectionMode);
  if (!transport) return null;
  return {
    send: (type: string, payload?: unknown) => transport.send(type, payload),
    sendBinary: (id: string, offset: number, chunk: ArrayBuffer) =>
      transport.sendBinary(id, offset, chunk),
  } satisfies Transport;
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
  const ackedBytesRef = useRef(new Map<string, number>());
  const ackWaitersRef = useRef(new Map<string, Set<(acked: number) => void>>());
  const sendQueueRef = useRef(Promise.resolve());

  const getAckedBytes = useCallback((id: string) => {
    return ackedBytesRef.current.get(id) ?? 0;
  }, []);

  const notifyAckWaiters = useCallback((id: string, acked: number) => {
    ackWaitersRef.current.get(id)?.forEach((waiter) => waiter(acked));
  }, []);

  const waitForAck = useCallback(
    (id: string, minBytes: number): Promise<void> => {
      if (
        getAckedBytes(id) >= minBytes ||
        cancelledTransfersRef.current.has(id)
      ) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const waiter = (acked: number) => {
          if (
            acked >= minBytes ||
            cancelledTransfersRef.current.has(id)
          ) {
            ackWaitersRef.current.get(id)?.delete(waiter);
            resolve();
          }
        };
        if (!ackWaitersRef.current.has(id)) {
          ackWaitersRef.current.set(id, new Set());
        }
        ackWaitersRef.current.get(id)!.add(waiter);
      });
    },
    [getAckedBytes],
  );

  const waitForSendWindow = useCallback(
    async (id: string, offset: number) => {
      const window = inFlightWindowBytes();
      while (offset - getAckedBytes(id) > window) {
        if (cancelledTransfersRef.current.has(id)) return;
        const targetAck = offset - window;
        await waitForAck(id, targetAck);
      }
    },
    [getAckedBytes, waitForAck],
  );

  const clearAckState = useCallback((id: string) => {
    ackedBytesRef.current.delete(id);
    ackWaitersRef.current.delete(id);
  }, []);

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
      notifyAckWaiters(id, Number.MAX_SAFE_INTEGER);
      transportSend(signaling, "file-cancel", { id });
      updateItem(id, { status: "interrupted" });
      chunkChains.current.delete(id);
      clearAckState(id);
      addActivity(`Cancelled ${item.name}`, "warn");
    },
    [addActivity, clearAckState, notifyAckWaiters, signaling, updateItem],
  );

  const handleFileCancel = useCallback(
    (payload: FileCancelPayload) => {
      cancelledTransfersRef.current.add(payload.id);
      transferWaiters.current.get(payload.id)?.(false);
      notifyAckWaiters(payload.id, Number.MAX_SAFE_INTEGER);
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
    [addActivity, notifyAckWaiters, updateItem],
  );

  const handleFileAck = useCallback(
    (payload: FileAckPayload) => {
      const item = useTransferStore.getState().items.find((i) => i.id === payload.id);
      if (!item || item.kind !== "file" || item.direction !== "send") return;
      const receivedBytes = Math.max(
        0,
        Math.min(payload.receivedBytes, item.size),
      );
      const prev = ackedBytesRef.current.get(payload.id) ?? 0;
      if (receivedBytes <= prev) return;
      ackedBytesRef.current.set(payload.id, receivedBytes);
      updateProgress(payload.id, receivedBytes, item.size);
      notifyAckWaiters(payload.id, receivedBytes);
    },
    [notifyAckWaiters, updateProgress],
  );

  const sendFileChunks = useCallback(
    async (
      transport: Transport,
      id: string,
      file: File,
      startOffset: number,
    ): Promise<boolean> => {
      const connectionMode = useTransferStore.getState().connectionMode;
      const chunkSize = chunkSizeForTransport(
        connectionMode,
        signaling.maxMessageBytes ?? undefined,
      );
      ackedBytesRef.current.set(id, startOffset);
      let offset = startOffset;
      while (offset < file.size) {
        if (isCancelled(id)) return false;
        await waitForSendWindow(id, offset);
        if (isCancelled(id)) return false;
        const slice = file.slice(offset, offset + chunkSize);
        const buffer = await slice.arrayBuffer();
        if (isCancelled(id)) return false;
        await transport.sendBinary(id, offset, buffer);
        offset += buffer.byteLength;
        updateProgress(id, offset, file.size);
      }
      await waitForAck(id, file.size);
      return !isCancelled(id);
    },
    [
      isCancelled,
      signaling.maxMessageBytes,
      updateProgress,
      waitForAck,
      waitForSendWindow,
    ],
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
    (files: FileList | File[]) => {
      const run = async () => {
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

          const ok = await sendFileChunks(transport, id, file, 0);
          if (!ok) {
            updateItem(id, { status: "interrupted" });
            clearAckState(id);
            continue;
          }
          const sha256 = await sha256Hex(file);
          transport.send("file-complete", { id, ...(sha256 ? { sha256 } : {}) });
          cancelledTransfersRef.current.delete(id);
          clearAckState(id);
          updateItem(id, { status: "done", progress: 100 });
          addActivity(`Sent ${file.name}`);
        }
      };

      const next = sendQueueRef.current.then(run, run);
      sendQueueRef.current = next;
      return next;
    },
    [addActivity, addItem, clearAckState, isCancelled, sendFileChunks, settings, signaling, t, updateItem, waitForTransferResponse],
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
      const ok = await sendFileChunks(transport, payload.id, item.file, offset);
      if (!ok) {
        updateItem(payload.id, { status: "interrupted" });
        clearAckState(payload.id);
        return;
      }
      const sha256 = await sha256Hex(item.file);
      transport.send("file-complete", {
        id: payload.id,
        ...(sha256 ? { sha256 } : {}),
      });
      cancelledTransfersRef.current.delete(payload.id);
      chunkChains.current.delete(payload.id);
      clearAckState(payload.id);
      updateItem(payload.id, { status: "done", progress: 100 });
      addActivity(`Resumed ${item.name}`);
    },
    [addActivity, clearAckState, isCancelled, sendFileChunks, signaling, updateItem],
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
        updateProgress(transferId, receivedBytes, item.size);
        if (shouldSendAck(receivedBytes, item.size)) {
          transportSend(signaling, "file-ack", {
            id: transferId,
            receivedBytes,
          });
        }
        const persist = async () => {
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
        };
        if (receivedBytes >= item.size) {
          await persist();
          const record = await getResumeRecord(transferId);
          if (record) {
            const blob = assembleBlob(record);
            updateItem(transferId, { blob, status: "done", progress: 100 });
            await deleteResumeRecord(transferId);
            chunkChains.current.delete(transferId);
            addActivity(`Received ${item.name}`);
            triggerRecvDownload(transferId);
          }
        } else {
          void persist();
        }
      };

      const prev = chunkChains.current.get(transferId) ?? Promise.resolve();
      const next = prev.then(run);
      chunkChains.current.set(transferId, next);
      await next;
    },
    [addActivity, isCancelled, roomId, signaling, triggerRecvDownload, updateItem, updateProgress],
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
    handleFileAck,
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
