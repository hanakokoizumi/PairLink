"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ArrowUpRight, Download } from "lucide-react";
import { motion } from "framer-motion";

const panels = [
  {
    key: "send",
    href: "/session/new" as const,
    icon: ArrowUpRight,
    accentVar: "--primary",
  },
  {
    key: "receive",
    icon: Download,
    accentVar: "--accent",
    static: true,
  },
] as const;

export function HomeSplit() {
  const t = useTranslations("home");

  return (
    <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-1 md:grid-cols-2">
      {panels.map((panel, index) => {
        const content = (
          <>
            <span
              className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl border shadow-[0_0_24px_var(--glow)] transition-shadow group-hover:shadow-[0_0_36px_var(--glow)]"
              style={{
                borderColor: `color-mix(in oklch, var(${panel.accentVar}) 40%, transparent)`,
                backgroundColor: `color-mix(in oklch, var(${panel.accentVar}) 12%, transparent)`,
                color: `var(${panel.accentVar})`,
              }}
            >
              <panel.icon className="h-7 w-7" />
            </span>
            <h2 className="font-mono text-2xl font-bold tracking-tight text-foreground">
              {t(panel.key)}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t(`${panel.key}Description`)}
            </p>
            {!("static" in panel) && (
              <span className="mt-6 font-mono text-xs uppercase tracking-widest text-primary opacity-0 transition-opacity group-hover:opacity-100">
                →
              </span>
            )}
          </>
        );

        return (
          <motion.div
            key={panel.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            className="relative flex flex-col items-center justify-center border-border p-8 md:p-12"
          >
            {index === 0 && (
              <div className="absolute right-0 top-8 bottom-8 hidden w-px bg-border md:block" />
            )}
            {index === 0 && (
              <div className="absolute bottom-0 left-8 right-8 h-px bg-border md:hidden" />
            )}

            {"static" in panel ? (
              <div className="flex max-w-sm flex-col items-center text-center">
                {content}
              </div>
            ) : (
              <Link
                href={panel.href}
                className="group flex max-w-sm flex-col items-center text-center transition-transform hover:scale-[1.02]"
              >
                {content}
              </Link>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
