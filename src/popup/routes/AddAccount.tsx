import React, { useState, useEffect } from "react";
import { ArrowLeftIcon, AlertIcon } from "../components/Icons";
import { decodeBase32 } from "../../crypto/base32";
import { parseOtpauthUri } from "../../otp/otpauthUri";
import { encryptVault } from "../../crypto/vaultCrypto";
import { getEncryptedVault, saveEncryptedVault } from "../../storage/vaultRepository";
import { base64urlToUint8Array } from "../../crypto/encoding";
import type { VaultEntry, PlaintextVault } from "../../types/vault";

interface AddAccountProps {
  vault: PlaintextVault;
  sessionKey: CryptoKey;
  editEntry?: VaultEntry | null;
  onBack: () => void;
  onUpdateVault: (vault: PlaintextVault) => void;
}

export default function AddAccount({
  vault,
  sessionKey,
  editEntry,
  onBack,
  onUpdateVault,
}: AddAccountProps) {
  const [issuer, setIssuer] = useState("");
  const [accountName, setAccountName] = useState("");
  const [secret, setSecret] = useState("");
  const [algorithm, setAlgorithm] = useState("SHA1");
  const [digits, setDigits] = useState(6);
  const [period, setPeriod] = useState(30);
  const [type, setType] = useState("totp");
  const [counter, setCounter] = useState(0);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load entry if editing
  useEffect(() => {
    if (editEntry) {
      setIssuer(editEntry.issuer);
      setAccountName(editEntry.accountName);
      
      // Format secret with spaces for readability (e.g. AAAA BBBB)
      const spacedSecret = editEntry.secretBase32.match(/.{1,4}/g)?.join(" ") || editEntry.secretBase32;
      setSecret(spacedSecret);
      
      setAlgorithm(editEntry.algorithm);
      setDigits(editEntry.digits);
      setPeriod(editEntry.period);
      setType(editEntry.type);
      setCounter(editEntry.counter || 0);
    }
  }, [editEntry]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanIssuer = issuer.trim();
    const cleanAccountName = accountName.trim();
    const cleanSecret = secret.replace(/\s+/g, "").toUpperCase();

    if (!cleanIssuer) {
      setError("Issuer is required.");
      return;
    }
    if (!cleanAccountName) {
      setError("Account name is required.");
      return;
    }
    if (!cleanSecret) {
      setError("Secret is required.");
      return;
    }

    // Validate Base32 secret
    try {
      decodeBase32(cleanSecret);
    } catch (err) {
      setError("Invalid Base32 secret. Verify there are no invalid characters (only A-Z, 2-7 are allowed).");
      return;
    }

    try {
      let updatedEntries: VaultEntry[];

      if (editEntry) {
        // Edit flow
        updatedEntries = vault.entries.map((item) => {
          if (item.id === editEntry.id) {
            return {
              ...item,
              issuer: cleanIssuer,
              accountName: cleanAccountName,
              secretBase32: cleanSecret,
              algorithm,
              digits,
              period,
              type,
              counter: type === "hotp" ? counter : null,
              updatedAt: new Date().toISOString(),
            };
          }
          return item;
        });
      } else {
        // Add flow
        const newEntry: VaultEntry = {
          id: globalThis.crypto.randomUUID(),
          issuer: cleanIssuer,
          accountName: cleanAccountName,
          secretBase32: cleanSecret,
          algorithm,
          digits,
          period,
          type,
          counter: type === "hotp" ? counter : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updatedEntries = [...vault.entries, newEntry];
      }

      const updatedVault = { ...vault, entries: updatedEntries };

      // Encrypt and save
      const encryptedVault = await getEncryptedVault();
      if (!encryptedVault) {
        throw new Error("No encrypted vault found in local storage.");
      }

      const salt = base64urlToUint8Array(encryptedVault.kdf.salt);
      const encrypted = await encryptVault(
        JSON.stringify(updatedVault),
        sessionKey,
        salt,
        encryptedVault.kdf.iterations
      );

      await saveEncryptedVault(encrypted);
      onUpdateVault(updatedVault);
      onBack();
    } catch (err: any) {
      setError(err.message || "Failed to save vault entry.");
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-title-group">
          <button onClick={onBack} className="btn-icon" title="Back">
            <ArrowLeftIcon size={16} />
          </button>
          <h1>{editEntry ? "Edit Account" : "Add Account"}</h1>
        </div>
      </header>

      <div className="scrollable-content">


        <form onSubmit={handleSubmit} className="flex flex-column text-left">
          <div className="form-row">
            <div className="form-group" style={{ textAlign: "left" }}>
              <label className="form-label" style={{ display: "block" }}>Issuer</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. GitHub"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ textAlign: "left" }}>
              <label className="form-label" style={{ display: "block" }}>Account Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. user@example.com"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ textAlign: "left" }}>
            <label className="form-label" style={{ display: "block" }}>Secret Key (Base32)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. JBSWY3DPEHPK3PXP"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-between align-center mt-4 mb-4" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "8px", cursor: "pointer" }} onClick={() => setShowAdvanced(!showAdvanced)}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>Advanced Settings</span>
            <span style={{ fontSize: "16px", color: "var(--text-secondary)" }}>{showAdvanced ? "▾" : "▸"}</span>
          </div>

          {showAdvanced && (
            <>
              <div className="form-row">
                <div className="form-group" style={{ textAlign: "left" }}>
                  <label className="form-label" style={{ display: "block" }}>Type</label>
                  <select
                    className="form-select"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="totp">Time-based (TOTP)</option>
                    <option value="hotp">Counter-based (HOTP)</option>
                  </select>
                </div>
                <div className="form-group" style={{ textAlign: "left" }}>
                  <label className="form-label" style={{ display: "block" }}>Algorithm</label>
                  <select
                    className="form-select"
                    value={algorithm}
                    onChange={(e) => setAlgorithm(e.target.value)}
                  >
                    <option value="SHA1">SHA-1 (Default)</option>
                    <option value="SHA256">SHA-256</option>
                    <option value="SHA512">SHA-512</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ textAlign: "left" }}>
                  <label className="form-label" style={{ display: "block" }}>Digits</label>
                  <select
                    className="form-select"
                    value={digits}
                    onChange={(e) => setDigits(parseInt(e.target.value, 10))}
                  >
                    <option value={6}>6 Digits</option>
                    <option value={8}>8 Digits</option>
                  </select>
                </div>

                {type === "totp" ? (
                  <div className="form-group" style={{ textAlign: "left" }}>
                    <label className="form-label" style={{ display: "block" }}>Period (Seconds)</label>
                    <input
                      type="number"
                      className="form-input"
                      min={1}
                      value={period}
                      onChange={(e) => setPeriod(parseInt(e.target.value, 10) || 30)}
                    />
                  </div>
                ) : (
                  <div className="form-group" style={{ textAlign: "left" }}>
                    <label className="form-label" style={{ display: "block" }}>Initial Counter</label>
                    <input
                      type="number"
                      className="form-input"
                      min={0}
                      value={counter}
                      onChange={(e) => setCounter(parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="error-alert flex align-center gap-8 mt-4" style={{ textAlign: "left" }}>
              <AlertIcon size={16} />
              <span style={{ flex: 1 }}>{error}</span>
            </div>
          )}

          <div className="flex gap-8 mt-4">
            <button type="button" onClick={onBack} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              {editEntry ? "Save Changes" : "Add Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
