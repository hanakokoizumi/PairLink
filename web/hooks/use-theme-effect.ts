"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useConfigStore } from "@/lib/stores/config-store";

export function useThemeEffect() {
  const config = useConfigStore((s) => s.config);
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    if (!config?.settings.defaultTheme) return;
    if (theme) return;
    const defaultTheme = config.settings.defaultTheme;
    if (["light", "dark", "system"].includes(defaultTheme)) {
      setTheme(defaultTheme);
    }
  }, [config, setTheme, theme]);
}
