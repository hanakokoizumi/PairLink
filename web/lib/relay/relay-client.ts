import type { SignalingClient } from "@/lib/webrtc/signaling";
import { frameBinaryChunk, parseBinaryChunk } from "@/lib/webrtc/datachannel";
import {
  decryptChunk,
  encryptChunk,
  type EncryptedChunk,
  type SessionKey,
} from "@/lib/crypto/session";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export type RelayMessage = {
  type: string;
  payload?: unknown;
};

export class RelayClient {
  private seq = 0;
  private handlers = new Map<string, Set<(payload: unknown) => void>>();
  private binaryHandlers = new Set<(data: ArrayBuffer) => void>();
  private relayChunkOff?: () => void;

  constructor(
    private signaling: SignalingClient,
    private sessionKey: SessionKey | null,
    private peerId: string,
  ) {
    this.relayChunkOff = this.signaling.on("relay-chunk", (payload) => {
      void this.handleIncoming(payload as EncryptedChunk & { transferId: string });
    });
  }

  dispose() {
    this.relayChunkOff?.();
    this.relayChunkOff = undefined;
    this.handlers.clear();
    this.binaryHandlers.clear();
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

  setSessionKey(key: SessionKey | null) {
    this.sessionKey = key;
  }

  setPeerId(peerId: string) {
    this.peerId = peerId;
  }

  async send(type: string, payload?: unknown) {
    const plaintext = new TextEncoder().encode(
      JSON.stringify({ type, payload }),
    );
    if (!this.sessionKey) {
      this.signaling.relayChunk({
        transferId: `__ctrl__:${type}`,
        seq: this.seq++,
        ciphertext: bytesToBase64(new Uint8Array(plaintext)),
        iv: "",
        to: this.peerId,
      });
      return;
    }
    const encrypted = await encryptChunk(this.sessionKey, plaintext);
    this.signaling.relayChunk({
      transferId: `__ctrl__:${type}`,
      seq: this.seq++,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      to: this.peerId,
    });
  }

  async sendBinary(transferId: string, offset: number, data: ArrayBuffer) {
    const framed = frameBinaryChunk(transferId, offset, data);
    if (!this.sessionKey) {
      this.signaling.relayChunk({
        transferId,
        seq: this.seq++,
        ciphertext: bytesToBase64(new Uint8Array(framed)),
        iv: "",
        to: this.peerId,
      });
      return;
    }
    const encrypted = await encryptChunk(this.sessionKey, framed);
    this.signaling.relayChunk({
      transferId,
      seq: this.seq++,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      to: this.peerId,
    });
  }

  private async handleIncoming(
    chunk: EncryptedChunk & { transferId: string },
  ) {
    try {
      const plain = chunk.iv
        ? await this.decryptChunk(chunk)
        : base64ToBuf(chunk.ciphertext);
      const text = new TextDecoder().decode(plain);
      try {
        const msg = JSON.parse(text) as RelayMessage;
        this.dispatch(msg.type, msg.payload);
      } catch {
        const parsed = parseBinaryChunk(plain);
        if (parsed) {
          this.dispatchBinary(plain);
        }
      }
    } catch {
      // decryption failed
    }
  }

  private async decryptChunk(chunk: EncryptedChunk): Promise<ArrayBuffer> {
    if (!this.sessionKey) {
      throw new Error("missing session key");
    }
    return decryptChunk(this.sessionKey, chunk.iv, chunk.ciphertext);
  }

  private dispatch(type: string, payload: unknown) {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) handler(payload);
  }

  private dispatchBinary(data: ArrayBuffer) {
    for (const handler of this.binaryHandlers) handler(data);
  }
}
