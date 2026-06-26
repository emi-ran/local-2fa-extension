import React, { useState } from "react";
import { LockIcon, UnlockIcon } from "../components/Icons";
import { base64urlToUint8Array } from "../../crypto/encoding";
import { deriveKey, decryptVault } from "../../crypto/vaultCrypto";
import { getEncryptedVault } from "../../storage/vaultRepository";
import { unlock } from "../../lock/lockManager";
import type { PlaintextVault } from "../../types/vault";

interface UnlockProps {
  onUnlocked: (key: CryptoKey, vault: PlaintextVault) => void;
}

export default function Unlock({ onUnlocked }: UnlockProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Fetch encrypted vault from local storage
      const encryptedVault = await getEncryptedVault();
      if (!encryptedVault) {
        setError("No vault found. Please reload or reinstall.");
        setLoading(false);
        return;
      }

      // 2. Decode the salt
      const salt = base64urlToUint8Array(encryptedVault.kdf.salt);
      const iterations = encryptedVault.kdf.iterations;

      // 3. Derive key
      const key = await deriveKey(password, salt, iterations);

      // 4. Decrypt vault
      const decryptedPlaintext = await decryptVault(encryptedVault, key);
      
      // 5. Parse decrypted vault
      const parsedVault: PlaintextVault = JSON.parse(decryptedPlaintext);

      // 6. Save in session storage
      await unlock(key, parsedVault.settings.autoLockMode);

      // 7. Callback
      onUnlocked(key, parsedVault);
    } catch (err) {
      console.warn("Unlock failure:", err);
      // Security Requirement: Show a generic wrong password error.
      // Do not reveal whether password, salt, or vault integrity failed.
      setError("Incorrect password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="flex flex-column align-center">
        <div className="auth-logo">
          <LockIcon size={48} />
        </div>
        <h2 className="mt-4">Vault is Locked</h2>
        <p className="mt-4">Enter your master password to unlock your 2FA authenticator vault.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-column text-left">
        <div className="form-group text-left" style={{ textAlign: "left" }}>
          <label className="form-label" style={{ display: "block" }}>Master Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            autoFocus
          />
        </div>

        {error && <div className="error-alert mt-4">{error}</div>}

        <button
          type="submit"
          className="btn btn-primary mt-4 flex justify-center align-center"
          disabled={loading}
        >
          {loading ? "Decrypting..." : (
            <>
              <UnlockIcon size={16} /> Unlock Vault
            </>
          )}
        </button>
      </form>
    </div>
  );
}
