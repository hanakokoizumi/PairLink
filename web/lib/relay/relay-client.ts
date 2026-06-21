import type { SignalingClient } from "@/lib/webrtc/signaling";
import {
  decryptChunk,
  encryptChunk,
  type EncryptedChunk,
} from "@/lib/crypto/e2e";

export type RelayMessage = {
  type: string;
  payload?: unknown;
};

export class RelayClient {
  private seq = 0;
  private handlers = new Map<string, Set<(payload: unknown) => void>>();

  constructor(
    private signaling: SignalingClient,
    private sessionKey: CryptoKey | null,
    private peerId: string,
  ) {
    this.signaling.on("relay-chunk", (payload) => {
      void this.handleIncoming(payload as EncryptedChunk & { transferId: string });
    });
  }

  on(type: string, handler: (payload: unknown) => void) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  setSessionKey(key: CryptoKey | null) {
    this.sessionKey = key;
  }

  async send(type: string, payload?: unknown) {
    if (!this.sessionKey) {
      this.dispatch(type, payload);
      return;
    }
    const plaintext = new TextEncoder().encode(
      JSON.stringify({ type, payload }),
    );
    const encrypted = await encryptChunk(this.sessionKey, plaintext);
    this.signaling.relayChunk({
      transferId: type,
      seq: this.seq++,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      to: this.peerId,
    });
  }

  async sendBinary(transferId: string, data: ArrayBuffer) {
    if (!this.sessionKey) return;
    const encrypted = await encryptChunk(this.sessionKey, data);
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
    if (!this.sessionKey) return;
    try {
      const plain = await decryptChunk(
        this.sessionKey,
        chunk.iv,
        chunk.ciphertext,
      );
      const text = new TextDecoder().decode(plain);
      try {
        const msg = JSON.parse(text) as RelayMessage;
        this.dispatch(msg.type, msg.payload);
      } catch {
        this.dispatch("binary", plain);
      }
    } catch {
      // decryption failed
    }
  }

  private dispatch(type: string, payload: unknown) {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) handler(payload);
  }
}
