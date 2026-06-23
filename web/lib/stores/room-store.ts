import { create } from "zustand";
import { createRoom, lookupRoom } from "@/lib/api";
import { localizeShareUrl } from "@/lib/locale-url";
import { useAuthStore } from "@/lib/stores/auth-store";

export type RoomRole = "host" | "guest";

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
  },
  joinByCode: async (code) => {
    const result = await lookupRoom(code);
    set({
      roomId: result.roomId,
      code,
      expiresAt: result.expiresAt,
      role: "guest",
    });
    return result.roomId;
  },
  setRoom: (data) => set(data),
  setPeerId: (peerId) => set({ peerId }),
  setRole: (role) => set({ role }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setPeerOnline: (peerOnline) => set({ peerOnline }),
  reset: () =>
    set({
      roomId: null,
      code: null,
      peerId: null,
      role: null,
      expiresAt: null,
      url: null,
      wsConnected: false,
      peerOnline: false,
    }),
}));
