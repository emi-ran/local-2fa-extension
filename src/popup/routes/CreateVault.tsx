import React, { useState, useEffect } from "react";
import { KeyIcon, LockIcon } from "../components/Icons";
import { generateRandomBytes, deriveKey, encryptVault } from "../../crypto/vaultCrypto";
import { saveEncryptedVault } from "../../storage/vaultRepository";
import { unlock } from "../../lock/lockManager";
import type { PlaintextVault } from "../../types/vault";

interface CreateVaultProps {
  onVaultCreated: (key: CryptoKey, vault: PlaintextVault) => void;
}

export default function CreateVault({ onVaultCreated }: CreateVaultProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [strength, setStrength] = useState({ label: "Too Short", color: "#ef4444" });

  useEffect(() => {
    if (password.length === 0) {
      setStrength({ label: "Empty", color: "var(--text-secondary)" });
      return;
    }
    if (password.length < 8) {
      setStrength({ label: "Too Short (Min 8)", color: "#ef4444" });
      return;
    }

    let score = 0;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) {
      setStrength({ label: "Weak", color: "#f97316" });
    } else if (score === 3) {
      setStrength({ label: "Medium", color: "#eab308" });
    } else {
      setStrength({ label: "Strong", color: "#10b981" });
    }
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (typeof window !== "undefined" && (!globalThis.crypto || !globalThis.crypto.subtle)) {
      setError("Web Crypto API (crypto.subtle) is not available. Please make sure the extension is loaded directly in Chrome via chrome://extensions, or served over HTTPS/localhost.");
      return;
    }

    try {
      // 1. Generate random salt (16 bytes)
      const salt = generateRandomBytes(16);

      // 2. Derive CryptoKey
      const key = await deriveKey(password, salt);

      // 3. Create default empty vault
      const defaultVault: PlaintextVault = {
        version: 1,
        settings: {
          autoLockMode: "after_5_minutes",
          theme: "system",
        },
        entries: [],
      };

      // 4. Encrypt vault
      const encryptedVault = await encryptVault(JSON.stringify(defaultVault), key, salt);

      // 5. Store in local storage
      await saveEncryptedVault(encryptedVault);

      // 6. Save key and settings in session storage
      await unlock(key, defaultVault.settings.autoLockMode);

      // 7. Proceed
      onVaultCreated(key, defaultVault);
    } catch (err: any) {
      console.error("Vault creation crypto failure details:", err);
      setError(`Failed to create vault: ${err.message || err.toString()}`);
    }
  };

  return (
    <div className="auth-screen">
      <div className="flex flex-column align-center">
        <div className="auth-logo">
          <LockIcon size={48} />
        </div>
        <h2 className="mt-4">Create Master Vault</h2>
        <p className="mt-4">
          Protect your 2FA accounts. Choose a strong password. This password is never sent to any server.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-column text-left">
        <div className="form-group text-left" style={{ textAlign: "left" }}>
          <label className="form-label" style={{ display: "block" }}>Master Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="Min 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          <div className="password-hint flex justify-between align-center">
            <span>Strength:</span>
            <span style={{ color: strength.color, fontWeight: "bold" }}>{strength.label}</span>
          </div>
        </div>

        <div className="form-group text-left" style={{ textAlign: "left" }}>
          <label className="form-label" style={{ display: "block" }}>Confirm Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {error && <div className="error-alert mt-4">{error}</div>}

        <button type="submit" className="btn btn-primary mt-4 flex justify-center align-center">
          <KeyIcon size={16} /> Create Encrypted Vault
        </button>
      </form>
    </div>
  );
}
