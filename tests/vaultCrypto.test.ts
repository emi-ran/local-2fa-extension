import { describe, it, expect } from "vitest";
import { deriveKey, encryptVault, decryptVault, generateRandomBytes } from "../src/crypto/vaultCrypto";

describe("Vault Cryptography", () => {
  const password = "SuperSecurePassword123!";
  const wrongPassword = "WrongPassword123!";
  const plaintext = JSON.stringify({
    version: 1,
    settings: { autoLockMode: "after_5_minutes", theme: "system" },
    entries: [],
  });

  it("should successfully encrypt and decrypt vault payload with correct password", async () => {
    const salt = generateRandomBytes(16);
    const key = await deriveKey(password, salt, 10000); // use fewer iterations to make tests run faster
    
    // Encrypt
    const encrypted = await encryptVault(plaintext, key, salt, 10000);
    expect(encrypted.version).toBe(1);
    expect(encrypted.cipher.name).toBe("AES-GCM");
    expect(encrypted.kdf.name).toBe("PBKDF2");

    // Decrypt
    const decrypted = await decryptVault(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it("should fail decryption when using a wrong password", async () => {
    const salt = generateRandomBytes(16);
    const correctKey = await deriveKey(password, salt, 10000);
    const wrongKey = await deriveKey(wrongPassword, salt, 10000);

    const encrypted = await encryptVault(plaintext, correctKey, salt, 10000);

    // Decrypting with wrong key should throw an error
    await expect(decryptVault(encrypted, wrongKey)).rejects.toThrow();
  });

  it("should generate unique IVs for each encryption operation", async () => {
    const salt = generateRandomBytes(16);
    const key = await deriveKey(password, salt, 10000);

    const encrypted1 = await encryptVault(plaintext, key, salt, 10000);
    const encrypted2 = await encryptVault(plaintext, key, salt, 10000);

    // IVs should be different
    expect(encrypted1.cipher.iv).not.toBe(encrypted2.cipher.iv);
    // Ciphertexts should be different because of unique IVs
    expect(encrypted1.cipher.ciphertext).not.toBe(encrypted2.cipher.ciphertext);
  });
});
