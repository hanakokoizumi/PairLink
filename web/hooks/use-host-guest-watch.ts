"use client";

import { useEffect, useRef } from "react";
import { SignalingClient } from "@/lib/webrtc/signaling";
import { useAuthStore } from "@/lib/stores/auth-store";

export function useHostGuestWatch(
  roomId: string | null,
  enabled: boolean,
  onGuestJoined: () => void,
) {
  const token = useAuthStore((s) => s.token);
  const onGuestJoinedRef = useRef(onGuestJoined);
  onGuestJoinedRef.current = onGuestJoined;

  useEffect(() => {
    if (!enabled || !roomId) return;

    const signaling = new SignalingClient(token ?? undefined);
    let disposed = false;

    void (async () => {
      try {
        await signaling.connect();
        if (disposed) return;
        signaling.hostJoin(roomId, token ?? undefined);
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
      signaling.disconnect();
    };
  }, [enabled, roomId, token]);
}
