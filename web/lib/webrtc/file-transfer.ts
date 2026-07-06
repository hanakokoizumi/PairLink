export const CHUNK_SIZE = 64 * 1024;
export const ACK_EVERY = 16;

export type FileMetaPayload = {
  id: string;
  name: string;
  size: number;
  mime: string;
  resume?: boolean;
};

export type FileAckPayload = {
  id: string;
  receivedBytes: number;
};

export type FileCompletePayload = {
  id: string;
  sha256?: string;
};

export type ChatPayload = {
  id: string;
  text?: string;
  textEnc?: { iv: string; ciphertext: string };
  at: number;
  masked?: boolean;
  format?: "markdown";
};

export type FilesTransferResponse = {
  id: string;
  accepted: boolean;
};

export function encodeControl(type: string, payload?: unknown): string {
  return JSON.stringify({ type, payload });
}

export function buildChunkFrame(
  transferId: string,
  offset: number,
  chunk: ArrayBuffer,
): ArrayBuffer {
  const idBytes = hexToBytes(transferId.replace(/-/g, "").padEnd(32, "0").slice(0, 32));
  const buf = new ArrayBuffer(25 + chunk.byteLength);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  bytes[0] = 0x01;
  bytes.set(idBytes.slice(0, 16), 1);
  view.setBigUint64(17, BigInt(offset), false);
  bytes.set(new Uint8Array(chunk), 25);
  return buf;
}

export function parseChunkFrame(data: ArrayBuffer): {
  transferId: string;
  offset: number;
  payload: ArrayBuffer;
} | null {
  if (data.byteLength < 25) return null;
  const bytes = new Uint8Array(data);
  if (bytes[0] !== 0x01) return null;
  const view = new DataView(data);
  const offset = Number(view.getBigUint64(17, false));
  const idHex = Array.from(bytes.slice(1, 17))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const transferId = formatUuidFromHex(idHex);
  return { transferId, offset, payload: data.slice(25) };
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function formatUuidFromHex(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function validateFileSize(size: number, maxBytes: number): boolean {
  return size <= maxBytes;
}

export function computeProgress(received: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, (received / total) * 100);
}

export function nextChunkOffset(sentBytes: number, fileSize: number): number {
  const remaining = fileSize - sentBytes;
  if (remaining <= 0) return sentBytes;
  return sentBytes + Math.min(CHUNK_SIZE, remaining);
}

export function shouldAck(chunkIndex: number): boolean {
  return chunkIndex > 0 && chunkIndex % ACK_EVERY === 0;
}
