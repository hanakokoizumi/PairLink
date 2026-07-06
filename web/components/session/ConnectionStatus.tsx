"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTransferStore } from "@/lib/stores/transfer-store";
import { useRoomStore } from "@/lib/stores/room-store";

type ConnectionStatusProps = {
  canSwitchToRelay?: boolean;
  onSwitchToRelay?: () => void;
  canSwitchToWebRTC?: boolean;
  onSwitchToWebRTC?: () => void;
};

export function ConnectionStatus({
  canSwitchToRelay = false,
  onSwitchToRelay,
  canSwitchToWebRTC = false,
  onSwitchToWebRTC,
}: ConnectionStatusProps) {
  const t = useTranslations("connection");
  const mode = useTransferStore((s) => s.connectionMode);
  const peerOnline = useRoomStore((s) => s.peerOnline);
  const wsConnected = useRoomStore((s) => s.wsConnected);

  const label =
    mode === "webrtc"
      ? t("webrtc")
      : mode === "relay"
        ? t("relay")
        : wsConnected
          ? t("connecting")
          : t("offline");

  const variant =
    mode === "webrtc"
      ? "success"
      : mode === "relay"
        ? "warning"
        : peerOnline
          ? "default"
          : "secondary";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${
          peerOnline ? "animate-pulse bg-primary" : "bg-muted-foreground"
        }`}
      />
      <Badge variant={variant}>{label}</Badge>
      {canSwitchToRelay && onSwitchToRelay && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onSwitchToRelay}
        >
          {t("switchToRelay")}
        </Button>
      )}
      {canSwitchToWebRTC && onSwitchToWebRTC && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onSwitchToWebRTC}
        >
          {t("switchToWebRTC")}
        </Button>
      )}
      {!peerOnline && wsConnected && (
        <span className="text-xs text-muted-foreground">
          {t("peerOffline")}
        </span>
      )}
    </div>
  );
}
