"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { SignalingClient } from "@/lib/webrtc/signaling";
import { useAuthStore } from "@/lib/stores/auth-store";
import { createRoomTabCoordinator } from "@/lib/room-tab-coordinator";

export function useHostGuestWatch(
  roomId: string | null,
  enabled: boolean,
  onGuestJoined: () => void,
) {
  const t = useTranslations();
  const token = useAuthStore((s) => s.token);
  const onGuestJoinedRef = useRef(onGuestJoined);

  useEffect(() => {
    onGuestJoinedRef.current = onGuestJoined;
  }, [onGuestJoined]);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const signaling = new SignalingClient(token ?? undefined);
    const tabCoordinator = createRoomTabCoordinator(roomId);
    let disposed = false;

    tabCoordinator?.setOnTakeover(() => {
      if (disposed) return;
      disposed = true;
      signaling.disconnect();
      toast.info(t("session.tabConflictTransferred"));
    });

    void (async () => {
      try {
        await signaling.connect();
        if (disposed) return;
        signaling.hostJoin(roomId, token ?? undefined);
        tabCoordinator?.announce("host");
        signaling.on("peer-joined", () => {
          if (!disposed) {
            onGuestJoinedRef.current();
          }
        });
      } catch {
        // Host can still enter the session manually.
      }
    })();

    return () => {
      disposed = true;
      tabCoordinator?.dispose();
      signaling.disconnect();
    };
  }, [enabled, roomId, t, token]);
}
