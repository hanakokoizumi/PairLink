export type RoomTabRole = "host" | "guest";

type CoordinatorMessage =
  | { type: "active"; roomId: string; role: RoomTabRole; tabId: string }
  | { type: "takeover"; roomId: string; tabId: string };

export type RoomTabCoordinator = {
  announce: (role: RoomTabRole) => void;
  requestTakeover: () => void;
  setOnTakeover: (handler: (() => void) | null) => void;
  dispose: () => void;
};

function createTabId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Coordinates room sessions across tabs in the same browser profile. */
export function createRoomTabCoordinator(roomId: string): RoomTabCoordinator | null {
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }

  const tabId = createTabId();
  const channel = new BroadcastChannel(`pairlink-room-${roomId}`);
  let onTakeover: (() => void) | null = null;

  channel.onmessage = (event: MessageEvent<CoordinatorMessage>) => {
    const msg = event.data;
    if (!msg || msg.tabId === tabId || msg.roomId !== roomId) return;
    if (msg.type === "takeover") {
      onTakeover?.();
    }
  };

  return {
    announce(role) {
      const msg: CoordinatorMessage = { type: "active", roomId, role, tabId };
      channel.postMessage(msg);
    },
    requestTakeover() {
      const msg: CoordinatorMessage = { type: "takeover", roomId, tabId };
      channel.postMessage(msg);
    },
    setOnTakeover(handler) {
      onTakeover = handler;
    },
    dispose() {
      channel.close();
      onTakeover = null;
    },
  };
}

export const TAB_TAKEOVER_DELAY_MS = 800;
