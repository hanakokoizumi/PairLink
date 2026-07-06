"use client";

import { useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { ConnectionStatus } from "@/components/session/ConnectionStatus";
import { SessionSettings } from "@/components/session/SessionSettings";
import { FileSendBar } from "@/components/session/FileSendBar";
import { MessageComposer } from "@/components/session/MessageComposer";
import { UnifiedItemList } from "@/components/session/UnifiedItemList";
import { ActivityLog } from "@/components/session/ActivityLog";
import { Button } from "@/components/ui/button";
import { useSignaling } from "@/hooks/use-signaling";
import { useTransfer } from "@/hooks/use-transfer";
import { useThemeEffect } from "@/hooks/use-theme-effect";
import {
  useRoomStore,
  loadPersistedSession,
  type RoomRole,
} from "@/lib/stores/room-store";
import { useConfigStore } from "@/lib/stores/config-store";
import { useTransferStore } from "@/lib/stores/transfer-store";
import { parseBinaryChunk } from "@/lib/webrtc/datachannel";
import { isWebRtcSupported } from "@/lib/webrtc/peer";
import type { ChatPayload, FileMetaPayload } from "@/lib/webrtc/file-transfer";
import { purgeExpiredRecords } from "@/lib/storage/resume-store";

type Props = {
  roomId: string;
};

export function TransferRoom({ roomId }: Props) {
  const t = useTranslations("session");
  const searchParams = useSearchParams();
  const persisted = loadPersistedSession(roomId);
  const code =
    useRoomStore((s) => s.code) ??
    searchParams.get("code") ??
    persisted?.code ??
    undefined;
  const role =
    useRoomStore((s) => s.role) ??
    persisted?.role ??
    (code ? "guest" : null);

  if (!role) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {t("missingSession")}
        </p>
      </div>
    );
  }

  return <TransferSession roomId={roomId} role={role} code={code} />;
}

function TransferSession({
  roomId,
  role,
  code,
}: {
  roomId: string;
  role: RoomRole;
  code?: string;
}) {
  const t = useTranslations("session");
  const router = useRouter();
  const resetRoom = useRoomStore((s) => s.reset);
  const clearTransfer = useTransferStore((s) => s.clear);
  const connectionMode = useTransferStore((s) => s.connectionMode);
  const revealMessage = useTransferStore((s) => s.revealMessage);
  const hideMessage = useTransferStore((s) => s.hideMessage);
  const wsFallback = useConfigStore((s) => s.config?.wsFallback ?? false);

  useThemeEffect();

  const signaling = useSignaling(roomId, role, code);
  const transfer = useTransfer(signaling, roomId);

  useEffect(() => {
    void purgeExpiredRecords();
  }, []);

  useEffect(() => {
    type MessageSource = {
      on: (type: string, handler: (payload: unknown) => void) => () => void;
      onBinary: (handler: (data: ArrayBuffer) => void) => () => void;
    };

    const attach = (source: MessageSource | null) => {
      if (!source) return () => undefined;

      const offMeta = source.on("file-meta", (payload) => {
        transfer.handleIncomingMeta(payload as FileMetaPayload);
      });
      const offResponse = source.on("files-transfer-response", (payload) => {
        transfer.handleTransferResponse(
          payload as { id: string; accepted: boolean },
        );
      });
      const offResumeQuery = source.on("file-resume-query", (payload) => {
        void transfer.handleResumeQuery((payload as { id: string }).id);
      });
      const offResumeState = source.on("file-resume-state", (payload) => {
        void transfer.handleResumeState(
          payload as { id: string; receivedBytes: number },
        );
      });
      const offChat = source.on("chat", (payload) => {
        transfer.handleIncomingChat(payload as ChatPayload);
      });
      const offComplete = source.on("file-complete", (payload) => {
        void transfer.handleFileComplete(payload as { id: string });
      });
      const offCancel = source.on("file-cancel", (payload) => {
        transfer.handleFileCancel(payload as { id: string });
      });
      const offAck = source.on("file-ack", (payload) => {
        transfer.handleFileAck(payload as { id: string; receivedBytes: number });
      });
      const offBinary = source.onBinary((data) => {
        const parsed = parseBinaryChunk(data);
        if (parsed) {
          void transfer.handleChunk(parsed.transferId, parsed.offset, parsed.payload);
        }
      });

      return () => {
        offMeta();
        offResponse();
        offResumeQuery();
        offResumeState();
        offChat();
        offComplete();
        offCancel();
        offAck();
        offBinary();
      };
    };

    const activeSource =
      connectionMode === "relay"
        ? signaling.relay
        : signaling.dataChannel?.readyState === "open"
          ? signaling.dataChannel
          : signaling.relay ?? signaling.dataChannel;

    return attach(activeSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handler fns listed explicitly; not whole transfer object
  }, [
    connectionMode,
    signaling.dataChannel,
    signaling.relay,
    transfer.handleChunk,
    transfer.handleFileComplete,
    transfer.handleFileCancel,
    transfer.handleIncomingChat,
    transfer.handleIncomingMeta,
    transfer.handleResumeQuery,
    transfer.handleResumeState,
    transfer.handleFileAck,
    transfer.handleTransferResponse,
  ]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const transferring = useTransferStore
        .getState()
        .items.some(
          (i) => i.kind === "file" && i.status === "transferring",
        );
      if (transferring) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const disabled = !signaling.peerOnline;
  const canSwitchToRelay =
    isWebRtcSupported() &&
    wsFallback &&
    signaling.peerOnline &&
    connectionMode !== "relay";

  const handleLeave = useCallback(() => {
    const transferring = useTransferStore
      .getState()
      .items.some(
        (i) => i.kind === "file" && i.status === "transferring",
      );
    if (transferring && !window.confirm(t("leaveWarning"))) return;
    signaling.leaveSession();
    clearTransfer();
    resetRoom();
    router.push("/");
  }, [clearTransfer, resetRoom, router, signaling, t]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4 lg:w-2/3">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t("title")}
            </p>
            <h1 className="mt-1 font-mono text-lg font-semibold tracking-tight">{roomId}</h1>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionStatus
              canSwitchToRelay={canSwitchToRelay}
              onSwitchToRelay={signaling.switchToRelay}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleLeave}
            >
              {t("leaveSession")}
            </Button>
          </div>
        </div>

        <UnifiedItemList
          onAccept={transfer.onAcceptFile}
          onReject={transfer.onRejectFile}
          onDownload={transfer.downloadFile}
          onResume={transfer.resumeFile}
          onCancel={transfer.cancelFile}
          onReveal={revealMessage}
          onHide={hideMessage}
        />

        <ActivityLog />
      </div>

      <aside className="flex w-full flex-col gap-4 lg:w-1/3">
        <SessionSettings />
        <FileSendBar onSend={transfer.sendFiles} disabled={disabled} />
        <MessageComposer onSend={transfer.sendMessage} disabled={disabled} />
      </aside>
    </div>
  );
}
