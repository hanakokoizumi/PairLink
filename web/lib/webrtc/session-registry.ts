import { SignalingClient } from "@/lib/webrtc/signaling";

type RoomSession = {
  signaling: SignalingClient;
  joined: boolean;
  mountCount: number;
  remotePeerId: string | null;
};

const roomSessions = new Map<string, RoomSession>();

export function acquireRoomSession(
  roomId: string,
  token?: string,
): RoomSession {
  let session = roomSessions.get(roomId);
  if (!session) {
    session = {
      signaling: new SignalingClient(token),
      joined: false,
      mountCount: 0,
      remotePeerId: null,
    };
    roomSessions.set(roomId, session);
  }
  session.mountCount++;
  return session;
}

export function releaseRoomSession(
  roomId: string,
  onDestroyed?: () => void,
  delayMs = 300,
) {
  setTimeout(() => {
    const session = roomSessions.get(roomId);
    if (!session) return;
    session.mountCount--;
    if (session.mountCount > 0) return;
    session.signaling.leaveRoom();
    roomSessions.delete(roomId);
    onDestroyed?.();
  }, delayMs);
}

export function destroyRoomSession(roomId: string) {
  const session = roomSessions.get(roomId);
  if (!session) return;
  session.signaling.leaveRoom();
  roomSessions.delete(roomId);
}

export function getRoomRemotePeerId(roomId: string): string | null {
  return roomSessions.get(roomId)?.remotePeerId ?? null;
}

export function setRoomRemotePeerId(
  roomId: string,
  remotePeerId: string | null,
) {
  const session = roomSessions.get(roomId);
  if (session) {
    session.remotePeerId = remotePeerId;
  }
}
