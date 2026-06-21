"use client";

import { useTranslations } from "next-intl";
import { FileItem } from "@/components/session/FileItem";
import { MessageItem } from "@/components/session/MessageItem";
import { useTransferStore } from "@/lib/stores/transfer-store";

type Props = {
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onDownload?: (id: string) => void;
  onResume?: (id: string) => void;
  onReveal?: (id: string) => void;
};

export function UnifiedItemList({
  onAccept,
  onReject,
  onDownload,
  onResume,
  onReveal,
}: Props) {
  const t = useTranslations("session");
  const items = useTransferStore((s) => s.items);

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
        <p className="font-mono text-sm text-muted-foreground">{t("waiting")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) =>
        item.kind === "file" ? (
          <FileItem
            key={item.id}
            item={item}
            onAccept={onAccept}
            onReject={onReject}
            onDownload={onDownload}
            onResume={onResume}
          />
        ) : (
          <MessageItem key={item.id} item={item} onReveal={onReveal} />
        ),
      )}
    </div>
  );
}
