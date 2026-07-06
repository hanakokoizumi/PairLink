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
import { useTransferStore } from "@/lib/stores/transfer-store";
import { parseBinaryChunk } from "@/lib/webrtc/datachannel";
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
        <p className="font-mono text-sm text-muted-foreground">
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
  }, [
    connectionMode,
    signaling.dataChannel,
    signaling.relay,
    transfer.handleChunk,
    transfer.handleFileComplete,
    transfer.handleIncomingChat,
    transfer.handleIncomingMeta,
    transfer.handleResumeQuery,
    transfer.handleResumeState,
    transfer.handleTransferResponse,
    transfer,
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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4 lg:w-2/3">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {t("title")}
            </p>
            <h1 className="mt-1 font-mono text-xl font-bold">{roomId}</h1>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionStatus />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="font-mono text-xs"
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
