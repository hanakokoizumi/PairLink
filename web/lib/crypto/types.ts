import type CryptoJS from "crypto-js";

export type EncryptedChunk = {
  iv: string;
  ciphertext: string;
  /** aes-gcm (Web Crypto) or aes-cbc (CryptoJS fallback for plain HTTP) */
  algo?: "aes-gcm" | "aes-cbc";
};

export type SessionKey =
  | { kind: "subtle"; key: CryptoKey }
  | { kind: "fallback"; key: CryptoJS.lib.WordArray };

export type KeyExchangePair =
  | {
      kind: "subtle";
      publicKey: CryptoKey;
      privateKey: CryptoKey;
      publicKeyJwk: JsonWebKey;
    }
  | {
      kind: "fallback";
      privateKey: Uint8Array;
      publicKey: Uint8Array;
    };
