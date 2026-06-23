"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { lookupRoom, mapErrorCode } from "@/lib/api";
import { useRoomStore } from "@/lib/stores/room-store";

export function CodeRedirect({ code }: { code: string }) {
  const t = useTranslations();
  const router = useRouter();
  const setRoom = useRoomStore((s) => s.setRoom);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await lookupRoom(code);
        if (cancelled) return;
        setRoom({
          roomId: result.roomId,
          code,
          expiresAt: result.expiresAt,
          role: "guest",
        });
        router.replace(`/session/${result.roomId}?code=${code}`);
      } catch (err) {
        if (cancelled) return;
        const errCode =
          err instanceof Error && "code" in err
            ? String((err as Error & { code: string }).code)
            : "room_not_found";
        setError(t(mapErrorCode(errCode)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router, setRoom, t]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="font-mono text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <p className="font-mono text-sm text-muted-foreground">{t("common.loading")}</p>
    </div>
  );
}
