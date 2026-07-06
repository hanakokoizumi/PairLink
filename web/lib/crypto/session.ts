import {
  decryptChunk as subtleDecryptChunk,
  deriveSessionKey as subtleDeriveSessionKey,
  encryptChunk as subtleEncryptChunk,
  encryptText as subtleEncryptText,
  decryptText as subtleDecryptText,
  generateKeyPair as generateSubtleKeyPair,
  importPublicKey,
  isCryptoAvailable,
  parsePublicKey,
} from "@/lib/crypto/e2e";
import {
  deriveFallbackSessionKey,
  decryptFallbackChunk,
  encryptFallbackChunk,
  generateFallbackKeyPair,
  isFallbackPublicKey,
  parseFallbackPublicKey,
  serializeFallbackPublicKey,
} from "@/lib/crypto/fallback";
import type {
  EncryptedChunk,
  KeyExchangePair,
  SessionKey,
} from "@/lib/crypto/types";

export type { EncryptedChunk, KeyExchangePair, SessionKey };

export { isCryptoAvailable };

export async function generateKeyPair(): Promise<KeyExchangePair> {
  if (isCryptoAvailable()) {
    const pair = await generateSubtleKeyPair();
    return {
      kind: "subtle",
      publicKey: pair.publicKey,
      privateKey: pair.privateKey,
      publicKeyJwk: pair.publicKeyJwk,
    };
  }
  const pair = generateFallbackKeyPair();
  return { kind: "fallback", ...pair };
}

export function serializePublicKey(pair: KeyExchangePair): string {
  if (pair.kind === "subtle") {
    return JSON.stringify(pair.publicKeyJwk);
  }
  return serializeFallbackPublicKey(pair.publicKey);
}

export async function deriveSessionKey(
  pair: KeyExchangePair,
  peerPublicKeySerialized: string,
): Promise<SessionKey> {
  const peerIsFallback = isFallbackPublicKey(peerPublicKeySerialized);
  if (pair.kind === "subtle" && !peerIsFallback) {
    const peerKey = await importPublicKey(parsePublicKey(peerPublicKeySerialized));
    const key = await subtleDeriveSessionKey(pair.privateKey, peerKey);
    return { kind: "subtle", key };
  }
  if (pair.kind === "fallback" && peerIsFallback) {
    const peerPub = parseFallbackPublicKey(peerPublicKeySerialized);
    const key = deriveFallbackSessionKey(pair.privateKey, peerPub);
    return { kind: "fallback", key };
  }
  throw new Error("crypto_kind_mismatch");
}

export async function encryptChunk(
  sessionKey: SessionKey,
  plaintext: ArrayBuffer | Uint8Array,
): Promise<EncryptedChunk> {
  if (sessionKey.kind === "subtle") {
    return subtleEncryptChunk(sessionKey.key, plaintext);
  }
  return encryptFallbackChunk(sessionKey.key, plaintext);
}

export async function decryptChunk(
  sessionKey: SessionKey,
  iv: string,
  ciphertext: string,
): Promise<ArrayBuffer> {
  if (sessionKey.kind === "subtle") {
    return subtleDecryptChunk(sessionKey.key, iv, ciphertext);
  }
  return decryptFallbackChunk(sessionKey.key, iv, ciphertext);
}

export async function encryptText(
  sessionKey: SessionKey,
  text: string,
): Promise<EncryptedChunk> {
  if (sessionKey.kind === "subtle") {
    return subtleEncryptText(sessionKey.key, text);
  }
  return encryptFallbackChunk(sessionKey.key, new TextEncoder().encode(text));
}

export async function decryptText(
  sessionKey: SessionKey,
  chunk: EncryptedChunk,
): Promise<string> {
  const plain = await decryptChunk(sessionKey, chunk.iv, chunk.ciphertext);
  return new TextDecoder().decode(plain);
}
