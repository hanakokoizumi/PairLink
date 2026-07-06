"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
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
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-8 transition-all duration-150 ease-out",
        dragging
          ? "border-primary/60 bg-primary/5 scale-[0.99]"
          : "border-border/60 bg-card/40 hover:border-primary/40 hover:bg-muted/30 active:scale-[0.99]",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <Upload className="mb-3 h-8 w-8 text-primary" />
      <p className="text-sm text-muted-foreground">{t("dropzone")}</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
