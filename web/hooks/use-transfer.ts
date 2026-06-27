"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { generateTransferId } from "@/lib/webrtc/datachannel";
import {
  CHUNK_SIZE,
  type ChatPayload,
  type FileMetaPayload,
  validateFileSize,
} from "@/lib/webrtc/file-transfer";
import {
  appendChunk,
  assembleBlob,
  deleteResumeRecord,
  getResumeRecord,
  saveResumeRecord,
} from "@/lib/storage/resume-store";
import { useConfigStore } from "@/lib/stores/config-store";
import { useTransferStore } from "@/lib/stores/transfer-store";
import type { SignalingState } from "@/hooks/use-signaling";

type Transport = {
  send: (type: string, payload?: unknown) => void;
  sendBinary: (transferId: string, offset: number, chunk: ArrayBuffer) => void;
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
      send: (type, payload) => void signaling.relay!.send(type, payload),
      sendBinary: (id, offset, chunk) =>
        void signaling.relay!.sendBinary(id, offset, chunk),
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

  const sendMessage = useCallback(
    (text: string, masked = false) => {
      const transport = getTransport(signaling);
      if (!transport || !settings) return;
      if (text.length > settings.messageMaxLength) {
        toast.error(t("errors.messageTooLong"));
        return;
      }
      const payload: ChatPayload = {
        id: generateTransferId(),
        text,
        at: Date.now(),
        masked,
        format: "markdown",
      };
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
        if (!accepted) {
          updateItem(id, { status: "rejected" });
          addActivity(`Transfer declined: ${file.name}`, "warn");
          continue;
        }

        let offset = 0;
        while (offset < file.size) {
          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const buffer = await slice.arrayBuffer();
          transport.sendBinary(id, offset, buffer);
          offset += buffer.byteLength;
          updateProgress(id, offset, file.size);
        }
        transport.send("file-complete", { id });
        updateItem(id, { status: "done", progress: 100 });
        addActivity(`Sent ${file.name}`);
      }
    },
    [addActivity, addItem, settings, signaling, t, updateItem, updateProgress, waitForTransferResponse],
  );

  const downloadFile = useCallback((id: string) => {
    const item = useTransferStore.getState().items.find((i) => i.id === id);
    if (!item || item.kind !== "file" || !item.blob) return;
    const url = URL.createObjectURL(item.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const resumeFile = useCallback(
    async (id: string) => {
      const item = useTransferStore.getState().items.find((i) => i.id === id);
      if (!item || item.kind !== "file") return;
      const transport = getTransport(signaling);
      if (!transport) return;
      transport.send("file-resume-query", { id });
      updateItem(id, { status: "resuming" });
      addActivity(`Resuming ${item.name}`);
    },
    [addActivity, signaling, updateItem],
  );

  const handleIncomingMeta = useCallback(
    (meta: FileMetaPayload) => {
      const autoAccept = settings?.autoAcceptFiles ?? true;
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
    [addItem, settings?.autoAcceptFiles, signaling],
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

  const handleChunk = useCallback(
    async (transferId: string, offset: number, payload: ArrayBuffer) => {
      const item = useTransferStore.getState().items.find((i) => i.id === transferId);
      if (!item || item.kind !== "file") return;
      if (item.status === "awaiting_accept" || item.status === "rejected") return;

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
        const record = await import("@/lib/storage/resume-store").then((m) =>
          m.getResumeRecord(transferId),
        );
        if (record) {
          const blob = assembleBlob(record);
          updateItem(transferId, { blob, status: "done" });
          await deleteResumeRecord(transferId);
        }
      }
    },
    [roomId, updateItem, updateProgress],
  );

  return {
    sendMessage,
    sendFiles,
    downloadFile,
    resumeFile,
    handleIncomingMeta,
    onAcceptFile,
    onRejectFile,
    handleChunk,
    handleTransferResponse,
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
