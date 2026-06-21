"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  onSend: (files: FileList | File[]) => void;
  disabled?: boolean;
};

export function FileSendBar({ onSend, disabled }: Props) {
  const t = useTranslations("file");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    onSend(files);
  };

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-8 transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border bg-card/40 hover:border-primary/40",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Upload className="mb-3 h-8 w-8 text-primary" />
        <p className="font-mono text-sm text-muted-foreground">{t("dropzone")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("select")}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full font-mono"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {t("send")}
      </Button>
    </div>
  );
}
