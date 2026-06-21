"use client";

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

export function ConnectionCard({
  open,
  onOpenChange,
  code,
  url,
  expiresAt,
  onContinue,
}: Props) {
  const t = useTranslations();

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(t("common.copied"));
  };

  const minutesLeft = expiresAt
    ? Math.max(
        0,
        Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000),
      )
    : null;

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
            {minutesLeft !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("connection.expiresIn", { minutes: minutesLeft })}
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
