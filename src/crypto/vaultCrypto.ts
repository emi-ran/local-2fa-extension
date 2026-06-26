import type { EncryptedVault } from "../types/vault";
import { base64urlToUint8Array, uint8ArrayToBase64url } from "./encoding";

export const KDF_ITERATIONS = 600000;

/**
 * Generates securely random bytes using the browser's crypto API.
 */
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from the master password and salt using PBKDF2-SHA256.
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = KDF_ITERATIONS
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  const baseKey = await globalThis.crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveKey", "deriveBits"]
  );

  return await globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true, // extractable so it can be stored in session storage for re-use
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts vault plaintext JSON string using the derived key.
 * Generates a unique 12-byte IV for this encryption operation.
 */
export async function encryptVault(
  plaintext: string,
  key: CryptoKey,
  salt: Uint8Array,
  iterations: number = KDF_ITERATIONS
): Promise<EncryptedVault> {
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);
  const iv = generateRandomBytes(12);

  const ciphertextBuffer = await globalThis.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      tagLength: 128,
    },
    key,
    plaintextBytes
  );

  const ciphertextBytes = new Uint8Array(ciphertextBuffer);

  const now = new Date().toISOString();

  return {
    version: 1,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: iterations,
      salt: uint8ArrayToBase64url(salt),
    },
    cipher: {
      name: "AES-GCM",
      iv: uint8ArrayToBase64url(iv),
      ciphertext: uint8ArrayToBase64url(ciphertextBytes),
      tagLength: 128,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Decrypts the encrypted vault using the derived key.
 * Throws an error if decryption or integrity checks fail.
 */
export async function decryptVault(
  encrypted: EncryptedVault,
  key: CryptoKey
): Promise<string> {
  const iv = base64urlToUint8Array(encrypted.cipher.iv);
  const ciphertext = base64urlToUint8Array(encrypted.cipher.ciphertext);

  const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
      tagLength: 128,
    },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
