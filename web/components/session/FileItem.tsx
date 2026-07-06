"use client";

import { useTranslations } from "next-intl";
import { Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { TransferItem } from "@/lib/stores/transfer-store";

type FileItemProps = Extract<TransferItem, { kind: "file" }>;

type Props = {
  item: FileItemProps;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onDownload?: (id: string) => void;
  onResume?: (id: string) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileItem({
  item,
  onAccept,
  onReject,
  onDownload,
  onResume,
}: Props) {
  const t = useTranslations("file");

  const statusLabel =
    item.status === "awaiting_accept"
      ? t("pending")
      : item.status === "transferring"
        ? t("transferring")
        : item.status === "interrupted"
          ? t("interrupted")
          : item.status === "resuming"
            ? t("resuming")
            : item.status === "done"
              ? t("complete")
              : item.status === "rejected"
                ? t("failed")
                : t("pending");

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors duration-150 hover:bg-muted/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {formatBytes(item.size)} · {item.direction === "send" ? "↑" : "↓"}
          </p>
        </div>
        <Badge variant={item.status === "done" ? "success" : "default"}>
          {statusLabel}
        </Badge>
      </div>

      {item.status !== "awaiting_accept" && item.status !== "rejected" && (
        <Progress value={item.progress} className="mt-3" />
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {item.status === "awaiting_accept" && (
          <>
            <Button size="sm" onClick={() => onAccept?.(item.id)}>
              {t("accept")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onReject?.(item.id)}>
              {t("reject")}
            </Button>
          </>
        )}
        {item.status === "done" && item.direction === "recv" && (
          <Button size="sm" variant="outline" onClick={() => onDownload?.(item.id)}>
            <Download className="mr-1 h-3 w-3" />
            {t("download")}
          </Button>
        )}
        {(item.status === "interrupted" || item.status === "resuming") &&
          item.direction === "send" && (
          <Button size="sm" variant="outline" onClick={() => onResume?.(item.id)}>
            <Play className="mr-1 h-3 w-3" />
            {t("resume")}
          </Button>
        )}
      </div>
    </div>
  );
}
