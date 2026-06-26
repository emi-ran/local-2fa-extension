import React, { useState } from "react";
import { ArrowLeftIcon, ImportIcon, EyeIcon, EyeOffIcon, CheckIcon } from "../components/Icons";
import { parseMigrationText } from "../../importers/googleAuthenticatorMigration";
import { encryptVault } from "../../crypto/vaultCrypto";
import { getEncryptedVault, saveEncryptedVault } from "../../storage/vaultRepository";
import { base64urlToUint8Array } from "../../crypto/encoding";
import type { VaultEntry, PlaintextVault } from "../../types/vault";

interface ImportProps {
  vault: PlaintextVault;
  sessionKey: CryptoKey;
  onBack: () => void;
  onUpdateVault: (vault: PlaintextVault) => void;
}

export default function Import({ vault, sessionKey, onBack, onUpdateVault }: ImportProps) {
  const [inputText, setInputText] = useState("");
  const [parsedEntries, setParsedEntries] = useState<VaultEntry[]>([]);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleParse = () => {
    setError("");
    setSuccess("");
    const text = inputText.trim();
    if (!text) {
      setError("Please paste some export text/URIs first.");
      return;
    }

    try {
      const results = parseMigrationText(text);
      if (results.length === 0) {
        setError("No valid 2FA entries or migration payloads found in the text.");
      } else {
        setParsedEntries(results);
      }
    } catch (err: any) {
      setError(err.message || "Failed to parse text.");
    }
  };

  const toggleRevealSecret = (id: string) => {
    setRevealedSecrets((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleImport = async () => {
    setError("");
    setSuccess("");
    if (parsedEntries.length === 0) return;

    try {
      // Deduplicate with respect to existing vault entries
      const existingKeys = new Set(
        vault.entries.map(
          (entry) =>
            `${entry.issuer.toLowerCase()}:${entry.accountName.toLowerCase()}:${entry.secretBase32}`
        )
      );

      const newUniqueEntries: VaultEntry[] = [];
      let skippedCount = 0;

      for (const entry of parsedEntries) {
        const key = `${entry.issuer.toLowerCase()}:${entry.accountName.toLowerCase()}:${entry.secretBase32}`;
        if (!existingKeys.has(key)) {
          newUniqueEntries.push(entry);
          existingKeys.add(key); // prevent duplicates within the import batch too
        } else {
          skippedCount++;
        }
      }

      if (newUniqueEntries.length === 0) {
        setError(`All ${parsedEntries.length} accounts already exist in your vault.`);
        return;
      }

      const mergedEntries = [...vault.entries, ...newUniqueEntries];
      const updatedVault = { ...vault, entries: mergedEntries };

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

      setSuccess(
        `Successfully imported ${newUniqueEntries.length} new accounts!${
          skippedCount > 0 ? ` (Skipped ${skippedCount} duplicate accounts)` : ""
        }`
      );

      // Clear states
      setInputText("");
      setParsedEntries([]);
      setRevealedSecrets({});
    } catch (err: any) {
      setError(err.message || "Import failed during encryption.");
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-title-group">
          <button onClick={onBack} className="btn-icon" title="Back">
            <ArrowLeftIcon size={16} />
          </button>
          <h1>Import Accounts</h1>
        </div>
      </header>

      <div className="scrollable-content">
        <p className="mb-4">
          To import from Google Authenticator: Open export screen, scan the QR code with any standard QR scanner app, and paste the text contents here. Multiple lines and standard <code>otpauth://</code> links are also supported.
        </p>

        <div className="form-group text-left" style={{ textAlign: "left" }}>
          <label className="form-label" style={{ display: "block" }}>Paste QR Text / URIs</label>
          <textarea
            className="form-input"
            rows={4}
            placeholder="Paste raw data or links here (one per line)...&#10;otpauth-migration://offline?data=...&#10;otpauth://totp/..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{ fontSize: "11px", resize: "none" }}
          />
        </div>

        <button
          onClick={handleParse}
          className="btn btn-secondary flex justify-center align-center w-100 mb-4"
          style={{ width: "100%" }}
        >
          Parse & Preview Accounts
        </button>

        {error && <div className="error-alert mb-4">{error}</div>}
        {success && <div className="success-alert mb-4">{success}</div>}

        {parsedEntries.length > 0 && (
          <div className="flex flex-column text-left">
            <h4 className="mb-4">Preview Accounts ({parsedEntries.length})</h4>
            <div className="import-preview-list">
              {parsedEntries.map((entry, index) => (
                <div key={index} className="preview-item flex-column" style={{ alignItems: "stretch", gap: "4px" }}>
                  <div className="flex justify-between align-center">
                    <div>
                      <strong>{entry.issuer}</strong> ({entry.accountName})
                    </div>
                    <span style={{ fontSize: "10px", color: "var(--accent)" }}>
                      {entry.type.toUpperCase()} • {entry.algorithm}
                    </span>
                  </div>
                  <div className="flex align-center justify-between mt-4" style={{ background: "rgba(0,0,0,0.05)", padding: "4px 8px", borderRadius: "6px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "10px" }}>
                      Secret: {revealedSecrets[entry.id] ? entry.secretBase32 : "••••••••••••••••"}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleRevealSecret(entry.id)}
                      className="btn-icon"
                      style={{ padding: "2px" }}
                      title={revealedSecrets[entry.id] ? "Hide secret" : "Reveal secret"}
                    >
                      {revealedSecrets[entry.id] ? <EyeOffIcon size={12} /> : <EyeIcon size={12} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleImport}
              className="btn btn-primary flex justify-center align-center mt-4 w-100"
              style={{ width: "100%" }}
            >
              <CheckIcon size={16} /> Confirm Import
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
