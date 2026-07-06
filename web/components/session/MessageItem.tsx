"use client";

import { useTranslations } from "next-intl";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/session/MarkdownRenderer";
import type { TransferItem } from "@/lib/stores/transfer-store";
import { copyToClipboard } from "@/lib/utils";

type MessageItemProps = Extract<TransferItem, { kind: "message" }>;

type Props = {
  item: MessageItemProps;
  onReveal?: (id: string) => void;
  onHide?: (id: string) => void;
};

export function MessageItem({ item, onReveal, onHide }: Props) {
  const t = useTranslations("session");
  const tRoot = useTranslations();
  const revealed = item.revealed ?? !item.masked;

  const showContent = () => {
    onReveal?.(item.id);
  };

  const hideContent = () => {
    onHide?.(item.id);
  };

  const copy = async () => {
    const ok = await copyToClipboard(item.text);
    if (ok) {
      toast.success(t("copyMessage"));
    } else {
      toast.error(tRoot("errors.generic"));
    }
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4 transition-colors duration-150 hover:bg-muted/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {item.masked && !revealed ? (
            <p className="font-mono text-sm tracking-widest text-muted-foreground">
              ••••••
            </p>
          ) : (
            <MarkdownRenderer content={item.text} />
          )}
          <p className="mt-2 text-xs text-muted-foreground">
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
