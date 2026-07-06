import CryptoJS from "crypto-js";
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import type { EncryptedChunk } from "@/lib/crypto/types";

const PUBLIC_KEY_PREFIX = "PL1:";

export type FallbackKeyPair = {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
};

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
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

function uint8ToWordArray(u8: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = [];
  for (let i = 0; i < u8.length; i += 4) {
    words.push(
      ((u8[i] ?? 0) << 24) |
        ((u8[i + 1] ?? 0) << 16) |
        ((u8[i + 2] ?? 0) << 8) |
        (u8[i + 3] ?? 0),
    );
  }
  return CryptoJS.lib.WordArray.create(words, u8.length);
}

function wordArrayToUint8Array(wa: CryptoJS.lib.WordArray): Uint8Array {
  const { words, sigBytes } = wa;
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    u8[i] = (words[i >>> 2]! >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return u8;
}

export function generateFallbackKeyPair(): FallbackKeyPair {
  const privateKey = p256.utils.randomSecretKey();
  const publicKey = p256.getPublicKey(privateKey, false);
  return { privateKey, publicKey };
}

export function serializeFallbackPublicKey(publicKey: Uint8Array): string {
  return PUBLIC_KEY_PREFIX + bufToBase64(publicKey);
}

export function parseFallbackPublicKey(serialized: string): Uint8Array {
  if (!serialized.startsWith(PUBLIC_KEY_PREFIX)) {
    throw new Error("invalid_fallback_public_key");
  }
  return new Uint8Array(base64ToBuf(serialized.slice(PUBLIC_KEY_PREFIX.length)));
}

export function isFallbackPublicKey(serialized: string): boolean {
  return serialized.startsWith(PUBLIC_KEY_PREFIX);
}

export function deriveFallbackSessionKey(
  privateKey: Uint8Array,
  peerPublicKey: Uint8Array,
): CryptoJS.lib.WordArray {
  const shared = p256.getSharedSecret(privateKey, peerPublicKey);
  return uint8ToWordArray(sha256(shared));
}

export function encryptFallbackChunk(
  key: CryptoJS.lib.WordArray,
  plaintext: ArrayBuffer | Uint8Array,
): EncryptedChunk {
  const bytes =
    plaintext instanceof Uint8Array
      ? plaintext
      : new Uint8Array(plaintext);
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(uint8ToWordArray(bytes), key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return {
    iv: CryptoJS.enc.Base64.stringify(iv),
    ciphertext: encrypted.ciphertext!.toString(CryptoJS.enc.Base64),
    algo: "aes-cbc",
  };
}

export function decryptFallbackChunk(
  key: CryptoJS.lib.WordArray,
  iv: string,
  ciphertext: string,
): ArrayBuffer {
  const decrypted = CryptoJS.AES.decrypt(
    CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(ciphertext),
    }),
    key,
    {
      iv: CryptoJS.enc.Base64.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    },
  );
  const bytes = wordArrayToUint8Array(decrypted);
  return bytes.slice().buffer;
}
