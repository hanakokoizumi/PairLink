"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const localeLabels: Record<string, string> = {
  en: "EN",
  "zh-CN": "简",
  "zh-TW": "繁",
  ja: "JA",
  ko: "KO",
};

export function LocaleToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const cycle = () => {
    const index = routing.locales.indexOf(locale as (typeof routing.locales)[number]);
    const next = routing.locales[(index + 1) % routing.locales.length];
    router.replace(pathname, { locale: next });
  };

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      aria-label="Toggle locale"
      title={locale}
    >
      <Globe className="h-3.5 w-3.5" />
      <span>{localeLabels[locale] ?? locale}</span>
    </button>
  );
}
