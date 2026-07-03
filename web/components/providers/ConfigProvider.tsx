"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useConfigStore } from "@/lib/stores/config-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const fetchConfig = useConfigStore((s) => s.fetchConfig);
  const loaded = useConfigStore((s) => s.loaded);
  const error = useConfigStore((s) => s.error);
  const hydrate = useAuthStore((s) => s.hydrate);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    hydrate();
    void fetchConfig().then(() => fetchMe());
  }, [fetchConfig, fetchMe, hydrate]);

  if (!loaded) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("errors.generic")}</p>
        <Button
          type="button"
          variant="outline"
          className="font-mono"
          onClick={() => {
            void fetchConfig().then(() => fetchMe());
          }}
        >
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
