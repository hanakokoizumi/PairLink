"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { ChevronDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const localeLabels: Record<string, string> = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ko: "한국어",
};

const localeShort: Record<string, string> = {
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

  const selectLocale = (next: (typeof routing.locales)[number]) => {
    if (next !== locale) {
      router.replace(pathname, { locale: next });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border border-border/40 bg-card/60 px-2.5 text-xs text-muted-foreground transition-all duration-150 hover:bg-muted/50 hover:text-foreground active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
        aria-label="Select language"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{localeShort[locale] ?? locale}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((code) => (
          <DropdownMenuCheckboxItem
            key={code}
            checked={code === locale}
            onCheckedChange={() => selectLocale(code)}
          >
            {localeLabels[code] ?? code}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
