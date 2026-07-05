"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/session/MarkdownRenderer";
import type { TransferItem } from "@/lib/stores/transfer-store";

type MessageItemProps = Extract<TransferItem, { kind: "message" }>;

type Props = {
  item: MessageItemProps;
  onReveal?: (id: string) => void;
  onHide?: (id: string) => void;
};

export function MessageItem({ item, onReveal, onHide }: Props) {
  const t = useTranslations("session");
  const [revealed, setRevealed] = useState(item.revealed ?? !item.masked);

  useEffect(() => {
    setRevealed(item.revealed ?? !item.masked);
  }, [item.revealed, item.masked]);

  const showContent = () => {
    setRevealed(true);
    onReveal?.(item.id);
  };

  const hideContent = () => {
    setRevealed(false);
    onHide?.(item.id);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(item.text);
    toast.success(t("copyMessage"));
  };

  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {item.masked && !revealed ? (
            <p className="font-mono text-sm tracking-widest text-muted-foreground">
              ••••••
            </p>
          ) : (
            <MarkdownRenderer content={item.text} />
          )}
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {item.direction === "send" ? t("maskedSent") : ""}{" "}
            {new Date(item.at).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {item.masked && !revealed && (
            <Button size="sm" variant="ghost" onClick={showContent}>
              <Eye className="mr-1 h-3 w-3" />
              {t("showContent")}
            </Button>
          )}
          {item.masked && revealed && (
            <Button size="sm" variant="ghost" onClick={hideContent}>
              <EyeOff className="mr-1 h-3 w-3" />
              {t("hideContent")}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={copy}>
            <Copy className="mr-1 h-3 w-3" />
            {t("copyMessage")}
          </Button>
        </div>
      </div>
    </div>
  );
}
