import { create } from "zustand";
import { fetchMe, login as apiLogin } from "@/lib/api";

const TOKEN_KEY = "pairlink:token";

type User = {
  sub: string;
  username: string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  hydrate: () => void;
  isAuthenticated: () => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  loading: false,
  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) set({ token });
  },
  isAuthenticated: () => Boolean(get().user ?? get().token),
  login: async (username, password) => {
    set({ loading: true });
    try {
      const { token } = await apiLogin(username, password);
      sessionStorage.setItem(TOKEN_KEY, token);
      set({ token, loading: false });
      await get().fetchMe();
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },
  logout: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null });
  },
  fetchMe: async () => {
    const token = get().token ?? undefined;
    try {
      const user = await fetchMe(token);
      set({ user });
    } catch {
      if (token) {
        sessionStorage.removeItem(TOKEN_KEY);
        set({ token: null, user: null });
      }
    }
  },
}));
