import { create } from "zustand";

const PREFS_KEY = "pairlink-preferences";

type StoredPreferences = {
  autoAcceptFiles?: boolean;
};

type PreferencesState = {
  autoAcceptFiles: boolean | null;
  hydrated: boolean;
  hydrate: (serverDefault?: boolean) => void;
  setAutoAcceptFiles: (value: boolean) => void;
  getAutoAcceptFiles: (serverDefault?: boolean) => boolean;
};

function readStoredAutoAccept(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPreferences;
    return typeof parsed.autoAcceptFiles === "boolean"
      ? parsed.autoAcceptFiles
      : null;
  } catch {
    return null;
  }
}

function writeStoredAutoAccept(value: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    PREFS_KEY,
    JSON.stringify({ autoAcceptFiles: value } satisfies StoredPreferences),
  );
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  autoAcceptFiles: null,
  hydrated: false,
  hydrate: (serverDefault = true) => {
    if (get().hydrated) return;
    const stored = readStoredAutoAccept();
    set({
      autoAcceptFiles: stored ?? serverDefault,
      hydrated: true,
    });
  },
  setAutoAcceptFiles: (value) => {
    writeStoredAutoAccept(value);
    set({ autoAcceptFiles: value, hydrated: true });
  },
  getAutoAcceptFiles: (serverDefault = true) => {
    const { autoAcceptFiles, hydrated } = get();
    if (!hydrated) {
      const stored = readStoredAutoAccept();
      return stored ?? serverDefault;
    }
    return autoAcceptFiles ?? serverDefault;
  },
}));
