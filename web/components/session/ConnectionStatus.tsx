"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { useTransferStore } from "@/lib/stores/transfer-store";
import { useRoomStore } from "@/lib/stores/room-store";

export function ConnectionStatus() {
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
      {!peerOnline && wsConnected && (
        <span className="font-mono text-xs text-muted-foreground">
          {t("peerOffline")}
        </span>
      )}
    </div>
  );
}
