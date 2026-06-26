import type { EncryptedVault } from "../types/vault";

const STORAGE_KEY = "vault_data";

export async function getEncryptedVault(): Promise<EncryptedVault | null> {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    return null;
  }
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || null;
}

export async function saveEncryptedVault(vault: EncryptedVault): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: vault });
}

export async function clearVault(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    return;
  }
  await chrome.storage.local.remove(STORAGE_KEY);
}
