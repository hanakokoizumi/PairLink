import { describe, expect, it } from "vitest";
import {
  decryptChunk,
  deriveSessionKey,
  encryptChunk,
  generateKeyPair,
  importPublicKey,
} from "@/lib/crypto/e2e";

describe("e2e crypto", () => {
  it("generates ECDH key pairs", async () => {
    const a = await generateKeyPair();
    expect(a.publicKeyJwk.kty).toBe("EC");
  });

  it("derives shared session key and encrypts round-trip", async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();

    const alicePeer = await importPublicKey(bob.publicKeyJwk);
    const bobPeer = await importPublicKey(alice.publicKeyJwk);

    const aliceKey = await deriveSessionKey(alice.privateKey, alicePeer);
    const bobKey = await deriveSessionKey(bob.privateKey, bobPeer);

    const plain = new TextEncoder().encode("hello pairlink").buffer;
    const encrypted = await encryptChunk(aliceKey, plain);
    const decrypted = await decryptChunk(
      bobKey,
      encrypted.iv,
      encrypted.ciphertext,
    );

    expect(new TextDecoder().decode(decrypted)).toBe("hello pairlink");
  });
});
