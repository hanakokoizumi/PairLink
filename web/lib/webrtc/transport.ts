import type { ConnectionMode } from "@/lib/stores/transfer-store";
import type { DataChannelClient } from "@/lib/webrtc/datachannel";
import type { RelayClient } from "@/lib/relay/relay-client";

export type MessageSource = {
  on: (type: string, handler: (payload: unknown) => void) => () => void;
  onBinary: (handler: (data: ArrayBuffer) => void) => () => void;
  send: (type: string, payload?: unknown) => void | Promise<void>;
  sendBinary: (
    transferId: string,
    offset: number,
    chunk: ArrayBuffer,
  ) => void | Promise<void>;
};

export type SignalingTransportState = {
  dataChannel: DataChannelClient | null;
  relay: RelayClient | null;
};

export function getActiveTransport(
  signaling: SignalingTransportState,
  connectionMode: ConnectionMode,
): MessageSource | null {
  if (
    connectionMode !== "relay" &&
    signaling.dataChannel?.readyState === "open"
  ) {
    return signaling.dataChannel;
  }
  if (signaling.relay) {
    return signaling.relay;
  }
  if (signaling.dataChannel?.readyState === "open") {
    return signaling.dataChannel;
  }
  return null;
}
