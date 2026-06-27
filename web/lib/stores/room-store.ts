import { create } from "zustand";
import { createRoom, lookupRoom } from "@/lib/api";
import { localizeShareUrl } from "@/lib/locale-url";
import { useAuthStore } from "@/lib/stores/auth-store";

export type RoomRole = "host" | "guest";

const SESSION_KEY = "pairlink-session";

type PersistedSession = {
  roomId: string;
  role: RoomRole;
  code?: string;
};

function persistSession(session: PersistedSession) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadPersistedSession(roomId: string): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as PersistedSession;
    return session.roomId === roomId ? session : null;
  } catch {
    return null;
  }
}

type RoomState = {
  roomId: string | null;
  code: string | null;
  peerId: string | null;
  role: RoomRole | null;
  expiresAt: string | null;
  url: string | null;
  wsConnected: boolean;
  peerOnline: boolean;
  createRoom: (locale?: string) => Promise<void>;
  joinByCode: (code: string) => Promise<string>;
  setRoom: (data: {
    roomId: string;
    code?: string;
    expiresAt?: string;
    url?: string;
    role?: RoomRole;
  }) => void;
  setPeerId: (peerId: string) => void;
  setRole: (role: RoomRole) => void;
  setWsConnected: (connected: boolean) => void;
  setPeerOnline: (online: boolean) => void;
  reset: () => void;
};

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  code: null,
  peerId: null,
  role: null,
  expiresAt: null,
  url: null,
  wsConnected: false,
  peerOnline: false,
  createRoom: async (locale?: string) => {
    const token = useAuthStore.getState().token ?? undefined;
    const room = await createRoom(token);
    set({
      roomId: room.roomId,
      code: room.code,
      expiresAt: room.expiresAt,
      url: locale ? localizeShareUrl(room.url, locale) : room.url,
      role: "host",
    });
    persistSession({ roomId: room.roomId, role: "host", code: room.code });
  },
  joinByCode: async (code) => {
    const result = await lookupRoom(code);
    set({
      roomId: result.roomId,
      code,
      expiresAt: result.expiresAt,
      role: "guest",
    });
    persistSession({ roomId: result.roomId, role: "guest", code });
    return result.roomId;
  },
  setRoom: (data) => {
    set(data);
    if (data.roomId && data.role) {
      persistSession({
        roomId: data.roomId,
        role: data.role,
        code: data.code,
      });
    }
  },
  setPeerId: (peerId) => set({ peerId }),
  setRole: (role) => set({ role }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setPeerOnline: (peerOnline) => set({ peerOnline }),
  reset: () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SESSION_KEY);
    }
    set({
      roomId: null,
      code: null,
      peerId: null,
      role: null,
      expiresAt: null,
      url: null,
      wsConnected: false,
      peerOnline: false,
    });
  },
}));
