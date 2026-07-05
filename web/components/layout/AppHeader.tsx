"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ThemeToggle } from "./ThemeToggle";
import { LocaleToggle } from "./LocaleToggle";
import { Link2, Github } from "lucide-react";

export function AppHeader() {
  const t = useTranslations("common");

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary shadow-[0_0_12px_var(--glow)]">
            <Link2 className="h-4 w-4" />
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
            {t("appName")}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/hanakokoizumi/PairLink"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
