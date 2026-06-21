"use client";

import { useEffect } from "react";
import { useConfigStore } from "@/lib/stores/config-store";
import { useAuthStore } from "@/lib/stores/auth-store";

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const fetchConfig = useConfigStore((s) => s.fetchConfig);
  const loaded = useConfigStore((s) => s.loaded);
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

  return <>{children}</>;
}
