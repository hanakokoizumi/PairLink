"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

function useMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/40 bg-card/60 text-muted-foreground",
          className,
        )}
        aria-label={t("toggle")}
      />
    );
  }

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/40 bg-card/60 text-muted-foreground transition-all duration-150 hover:bg-muted/50 hover:text-foreground active:scale-95",
        className,
      )}
      aria-label={t("toggle")}
      title={t(theme === "system" ? "system" : theme === "light" ? "light" : "dark")}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
