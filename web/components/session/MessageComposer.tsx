"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { MarkdownRenderer } from "@/components/session/MarkdownRenderer";
import { useConfigStore } from "@/lib/stores/config-store";

type Props = {
  onSend: (text: string, masked: boolean) => void;
  disabled?: boolean;
};

export function MessageComposer({ onSend, disabled }: Props) {
  const t = useTranslations("session");
  const defaultMask = useConfigStore(
    (s) => s.config?.settings.defaultMaskOnSend ?? false,
  );
  const [text, setText] = useState("");
  const [masked, setMasked] = useState(defaultMask);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim(), masked);
    setText("");
  };

  return (
    <div className="space-y-3">
      <Tabs defaultValue="write">
        <TabsList className="w-full">
          <TabsTrigger value="write" className="flex-1 text-xs">
            {t("tabWrite")}
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex-1 text-xs">
            {t("tabPreview")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="write">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("sendMessage")}
            disabled={disabled}
          />
        </TabsContent>
        <TabsContent value="preview">
          <div className="min-h-[120px] rounded-md border border-border bg-background p-3">
            {text ? (
              <MarkdownRenderer content={text} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("markdownHint")}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-2">
        <input
          id="mask-message"
          type="checkbox"
          checked={masked}
          onChange={(e) => setMasked(e.target.checked)}
          className="rounded border-border"
        />
        <Label htmlFor="mask-message" className="normal-case tracking-normal">
          {t("maskMessage")}
        </Label>
      </div>

      <Button
        className="w-full"
        onClick={handleSend}
        disabled={disabled || !text.trim()}
      >
        {t("sendMessage")}
      </Button>
    </div>
  );
}
