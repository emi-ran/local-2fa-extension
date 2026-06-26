export interface KdfParameters {
  name: string;
  hash: string;
  iterations: number;
  salt: string; // base64url
}

export interface CipherParameters {
  name: string;
  iv: string; // base64url
  ciphertext: string; // base64url
  tagLength: number; // 128
}

export interface EncryptedVault {
  version: number;
  kdf: KdfParameters;
  cipher: CipherParameters;
  createdAt: string;
  updatedAt: string;
}

export interface VaultSettings {
  autoLockMode: string; // "immediately" | "after_1_minute" | "after_5_minutes" | "after_15_minutes" | "after_1_hour" | "on_browser_close" | "manual_only"
  theme: string; // "light" | "dark" | "system"
}

export interface VaultEntry {
  id: string; // uuid
  issuer: string;
  accountName: string;
  secretBase32: string;
  algorithm: string; // "SHA1" | "SHA256" | "SHA512"
  digits: number; // 6 | 8
  period: number; // default 30
  type: string; // "totp" | "hotp"
  counter: number | null; // counter for hotp
  createdAt: string;
  updatedAt: string;
}

export interface PlaintextVault {
  version: number;
  settings: VaultSettings;
  entries: VaultEntry[];
}
