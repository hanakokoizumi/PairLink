"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  url: string;
  expiresAt: string | null;
  onContinue?: () => void;
};

function useMinutesLeft(expiresAt: string | null) {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!expiresAt) return () => undefined;
      const id = window.setInterval(onStoreChange, 60_000);
      return () => window.clearInterval(id);
    },
    () => {
      if (!expiresAt) return null;
      return Math.max(
        0,
        Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000),
      );
    },
    () => null,
  );
}

export function ConnectionCard({
  open,
  onOpenChange,
  code,
  url,
  expiresAt,
  onContinue,
}: Props) {
  const t = useTranslations();
  const minutesLeft = useMinutesLeft(expiresAt);

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(t("common.copied"));
  };

  const minutesLeftDisplay = minutesLeft;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("connection.sessionReady")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <p className="font-mono text-4xl font-bold tracking-[0.4em] text-primary">
              {code}
            </p>
            {minutesLeftDisplay !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("connection.expiresIn", { minutes: minutesLeftDisplay })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("session.roomCode")}</Label>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copy(url)}
                aria-label={t("common.copy")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {url && (
            <div className="flex justify-center rounded-lg border border-border bg-background p-4">
              <QRCodeSVG value={url} size={160} level="M" />
            </div>
          )}

          {onContinue && (
            <Button className="w-full font-mono" onClick={onContinue}>
              {t("connection.sessionReady")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
