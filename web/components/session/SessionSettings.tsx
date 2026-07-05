"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfigStore } from "@/lib/stores/config-store";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { cn } from "@/lib/utils";

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
  const autoAcceptFiles = usePreferencesStore((s) => s.autoAcceptFiles);
  const hydrated = usePreferencesStore((s) => s.hydrated);
  const hydrate = usePreferencesStore((s) => s.hydrate);
  const setAutoAcceptFiles = usePreferencesStore((s) => s.setAutoAcceptFiles);

  useEffect(() => {
    if (settings) {
      hydrate(settings.autoAcceptFiles);
    }
  }, [hydrate, settings]);

  if (!settings) return null;

  const autoAcceptValue = hydrated
    ? (autoAcceptFiles ?? settings.autoAcceptFiles)
    : settings.autoAcceptFiles;

  const serverRows = [
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
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {t("session.browserPreferences")}
        </p>
        <div className="flex items-center justify-between gap-3 font-mono text-xs">
          <span className="text-muted-foreground">{t("session.autoAccept")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={autoAcceptValue}
            aria-label={t("session.autoAccept")}
            onClick={() => setAutoAcceptFiles(!autoAcceptValue)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border transition-colors",
              autoAcceptValue ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "pointer-events-none block h-4 w-4 rounded-full bg-background shadow transition-transform",
                autoAcceptValue ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("session.autoAcceptHint")}
        </p>

        <p className="pt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {t("session.serverLimits")}
        </p>
        {serverRows.map((row) => (
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
