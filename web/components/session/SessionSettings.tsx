"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfigStore } from "@/lib/stores/config-store";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function SessionSettings() {
  const t = useTranslations();
  const settings = useConfigStore((s) => s.config?.settings);

  if (!settings) return null;

  const rows = [
    { label: t("session.autoAccept"), value: settings.autoAcceptFiles ? "ON" : "OFF" },
    {
      label: t("session.defaultMask"),
      value: settings.defaultMaskOnSend ? "ON" : "OFF",
    },
    {
      label: t("session.maxFileSize"),
      value: formatBytes(settings.fileMaxSizeBytes),
    },
    {
      label: t("session.maxMessageLength"),
      value: String(settings.messageMaxLength),
    },
    {
      label: t("session.resumeEnabled"),
      value: settings.resumeTransferEnabled ? "ON" : "OFF",
    },
  ];

  return (
    <Card className="border-border/80 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{t("session.settings")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between font-mono text-xs"
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span>{row.value}</span>
          </div>
        ))}
        <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
          {t("session.settingsHint")}
        </p>
      </CardContent>
    </Card>
  );
}
