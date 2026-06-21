const ALGO = { name: "AES-GCM", length: 256 } as const;
const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;

export type KeyPairBundle = {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
};

export type EncryptedChunk = {
  iv: string;
  ciphertext: string;
};

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
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

export async function generateKeyPair(): Promise<KeyPairBundle> {
  const pair = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]);
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { ...pair, publicKeyJwk };
}

export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ECDH, true, []);
}

export async function deriveSessionKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    privateKey,
    ALGO,
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptChunk(
  key: CryptoKey,
  plaintext: ArrayBuffer | Uint8Array,
): Promise<EncryptedChunk> {
  const bytes =
    plaintext instanceof Uint8Array
      ? plaintext
      : new Uint8Array(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    bytes.buffer as ArrayBuffer,
  );
  return {
    iv: bufToBase64(iv.buffer),
    ciphertext: bufToBase64(ciphertext),
  };
}

export async function decryptChunk(
  key: CryptoKey,
  iv: string,
  ciphertext: string,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(base64ToBuf(iv)) },
    key,
    base64ToBuf(ciphertext),
  );
}

export function serializePublicKey(jwk: JsonWebKey): string {
  return JSON.stringify(jwk);
}

export function parsePublicKey(serialized: string): JsonWebKey {
  return JSON.parse(serialized) as JsonWebKey;
}
