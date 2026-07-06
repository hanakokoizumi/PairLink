import { BUFFER_LOW_THRESHOLD } from "@/lib/webrtc/file-transfer";

export type ControlMessage = {
  type: string;
  payload?: unknown;
};

const BINARY_MARKER = 0x01;

export class DataChannelClient {
  private channel: RTCDataChannel;
  private handlers = new Map<string, Set<(payload: unknown) => void>>();
  private binaryHandlers = new Set<(data: ArrayBuffer) => void>();

  constructor(channel: RTCDataChannel) {
    this.channel = channel;
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = BUFFER_LOW_THRESHOLD;
    channel.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        try {
          const msg = JSON.parse(ev.data) as ControlMessage;
          this.dispatch(msg.type, msg.payload);
        } catch {
          // ignore
        }
      } else if (ev.data instanceof ArrayBuffer) {
        for (const handler of this.binaryHandlers) handler(ev.data);
      }
    };
  }

  get readyState(): RTCDataChannelState {
    return this.channel.readyState;
  }

  on(type: string, handler: (payload: unknown) => void) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  onBinary(handler: (data: ArrayBuffer) => void) {
    this.binaryHandlers.add(handler);
    return () => this.binaryHandlers.delete(handler);
  }

  private dispatch(type: string, payload: unknown) {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) handler(payload);
  }

  send(type: string, payload?: unknown) {
    if (this.channel.readyState !== "open") return;
    this.channel.send(JSON.stringify({ type, payload }));
  }

  async sendBinary(
    transferId: string,
    offset: number,
    chunk: ArrayBuffer,
  ): Promise<void> {
    if (this.channel.readyState !== "open") return;
    const frame = frameBinaryChunk(transferId, offset, chunk);
    await this.waitForBufferCapacity(frame.byteLength);
    if (this.channel.readyState !== "open") return;
    this.channel.send(frame);
  }

  private waitForBufferCapacity(appendBytes: number): Promise<void> {
    const threshold = this.channel.bufferedAmountLowThreshold;
    if (this.channel.bufferedAmount + appendBytes <= threshold) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const check = () => {
        if (
          this.channel.readyState !== "open" ||
          this.channel.bufferedAmount + appendBytes <= threshold
        ) {
          this.channel.removeEventListener("bufferedamountlow", check);
          resolve();
        }
      };
      this.channel.addEventListener("bufferedamountlow", check);
    });
  }
}

export function frameBinaryChunk(
  transferId: string,
  offset: number,
  chunk: ArrayBuffer,
): ArrayBuffer {
  const idBytes = parseTransferId(transferId);
  const buf = new ArrayBuffer(1 + 16 + 8 + chunk.byteLength);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  bytes[0] = BINARY_MARKER;
  bytes.set(idBytes, 1);
  view.setBigUint64(17, BigInt(offset), false);
  bytes.set(new Uint8Array(chunk), 25);
  return buf;
}

export function parseBinaryChunk(data: ArrayBuffer): {
  transferId: string;
  offset: number;
  payload: ArrayBuffer;
} | null {
  if (data.byteLength < 25) return null;
  const bytes = new Uint8Array(data);
  if (bytes[0] !== BINARY_MARKER) return null;
  const idBytes = bytes.slice(1, 17);
  const view = new DataView(data);
  const offset = Number(view.getBigUint64(17, false));
  const payload = data.slice(25);
  return {
    transferId: formatTransferId(idBytes),
    offset,
    payload,
  };
}

function parseTransferId(id: string): Uint8Array {
  const hex = id.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return bytes;
}

function formatTransferId(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generateTransferId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return formatTransferId(bytes);
}
