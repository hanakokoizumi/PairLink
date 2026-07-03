import { create } from "zustand";
import { fetchConfig, type PublicConfig } from "@/lib/api";

type ConfigState = {
  config: PublicConfig | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  fetchConfig: () => Promise<PublicConfig>;
  setConfig: (config: PublicConfig) => void;
};

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  loaded: false,
  loading: false,
  error: null,
  setConfig: (config) => set({ config, loaded: true }),
  fetchConfig: async () => {
    if (get().loading) {
      const existing = get().config;
      if (existing) return existing;
    }
    set({ loading: true, error: null });
    try {
      const config = await fetchConfig();
      set({ config, loaded: true, loading: false });
      return config;
    } catch (err) {
      const message = err instanceof Error ? err.message : "config_error";
      set({ error: message, loading: false, loaded: true });
      throw err;
    }
  },
}));

export function getSettings() {
  return useConfigStore.getState().config?.settings ?? null;
}
