import { describe, expect, it } from "vitest";
import {
  decryptFallbackChunk,
  deriveFallbackSessionKey,
  encryptFallbackChunk,
  generateFallbackKeyPair,
  isFallbackPublicKey,
  serializeFallbackPublicKey,
} from "@/lib/crypto/fallback";
import {
  decryptText,
  deriveSessionKey,
  encryptText,
  generateKeyPair,
  serializePublicKey,
} from "@/lib/crypto/session";

describe("fallback crypto", () => {
  it("exchanges P-256 keys and encrypts round-trip", () => {
    const alice = generateFallbackKeyPair();
    const bob = generateFallbackKeyPair();

    const aliceSerialized = serializeFallbackPublicKey(alice.publicKey);
    expect(isFallbackPublicKey(aliceSerialized)).toBe(true);

    const aliceKey = deriveFallbackSessionKey(alice.privateKey, bob.publicKey);
    const bobKey = deriveFallbackSessionKey(bob.privateKey, alice.publicKey);

    const plain = new TextEncoder().encode("masked on plain http").buffer;
    const encrypted = encryptFallbackChunk(aliceKey, plain);
    expect(encrypted.algo).toBe("aes-cbc");

    const decrypted = decryptFallbackChunk(
      bobKey,
      encrypted.iv,
      encrypted.ciphertext,
    );
    expect(new TextDecoder().decode(decrypted)).toBe("masked on plain http");
  });
});

describe("session crypto", () => {
  it("derives matching fallback session keys from serialized public keys", async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    if (alice.kind !== "fallback" || bob.kind !== "fallback") {
      return;
    }

    const aliceSession = await deriveSessionKey(
      alice,
      serializePublicKey(bob),
    );
    const bobSession = await deriveSessionKey(
      bob,
      serializePublicKey(alice),
    );

    const encrypted = await encryptText(aliceSession, "hello masked");
    const text = await decryptText(bobSession, encrypted);
    expect(text).toBe("hello masked");
  });
});
