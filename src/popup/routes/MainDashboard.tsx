import React, { useState, useEffect } from "react";
import {
  LockIcon,
  SettingsIcon,
  SearchIcon,
  CopyIcon,
  EditIcon,
  TrashIcon,
  PlusIcon,
  ImportIcon,
  CheckIcon,
} from "../components/Icons";
import { generateTOTP } from "../../otp/totp";
import { generateHOTP } from "../../otp/hotp";
import { checkLockTimeout, lock } from "../../lock/lockManager";
import { encryptVault } from "../../crypto/vaultCrypto";
import { saveEncryptedVault } from "../../storage/vaultRepository";
import type { VaultEntry, PlaintextVault } from "../../types/vault";
import { base64urlToUint8Array } from "../../crypto/encoding";
import { getEncryptedVault } from "../../storage/vaultRepository";

interface MainDashboardProps {
  vault: PlaintextVault;
  sessionKey: CryptoKey;
  onLock: () => void;
  onNavigate: (screen: string, extraData?: any) => void;
  onUpdateVault: (vault: PlaintextVault) => void;
}

export default function MainDashboard({
  vault,
  sessionKey,
  onLock,
  onNavigate,
  onUpdateVault,
}: MainDashboardProps) {
  const [search, setSearch] = useState("");
  const [timeSeconds, setTimeSeconds] = useState(Math.floor(Date.now() / 1000));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeDomainKeywords, setActiveDomainKeywords] = useState<string[]>([]);

  // Set up second ticks and lock timeout checks
  useEffect(() => {
    const timer = setInterval(async () => {
      const now = Math.floor(Date.now() / 1000);
      setTimeSeconds(now);

      // Check for lock timeout
      const lockedState = await checkLockTimeout();
      if (lockedState) {
        onLock();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [onLock]);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0 && tabs[0].url) {
          try {
            const url = new URL(tabs[0].url);
            if (url.protocol === "http:" || url.protocol === "https:") {
              const hostname = url.hostname;
              const parts = hostname.split(".").filter((p) => p !== "www");
              setActiveDomainKeywords(parts);
            }
          } catch (e) {
            // ignore invalid urls
          }
        }
      });
    }
  }, []);

  const handleLock = async () => {
    await lock();
    onLock();
  };

  const handleIncrementHotp = async (entry: VaultEntry) => {
    const updatedEntries = vault.entries.map((item) => {
      if (item.id === entry.id) {
        return {
          ...item,
          counter: (item.counter || 0) + 1,
          updatedAt: new Date().toISOString(),
        };
      }
      return item;
    });

    const updatedVault = { ...vault, entries: updatedEntries };

    try {
      const encryptedVault = await getEncryptedVault();
      if (encryptedVault) {
        const salt = base64urlToUint8Array(encryptedVault.kdf.salt);
        const encrypted = await encryptVault(
          JSON.stringify(updatedVault),
          sessionKey,
          salt,
          encryptedVault.kdf.iterations
        );
        await saveEncryptedVault(encrypted);
        onUpdateVault(updatedVault);
      }
    } catch (err) {
      console.error("Failed to increment HOTP:", err);
    }
  };

  const handleDelete = async (entryId: string) => {
    const updatedEntries = vault.entries.filter((item) => item.id !== entryId);
    const updatedVault = { ...vault, entries: updatedEntries };

    try {
      const encryptedVault = await getEncryptedVault();
      if (encryptedVault) {
        const salt = base64urlToUint8Array(encryptedVault.kdf.salt);
        const encrypted = await encryptVault(
          JSON.stringify(updatedVault),
          sessionKey,
          salt,
          encryptedVault.kdf.iterations
        );
        await saveEncryptedVault(encrypted);
        onUpdateVault(updatedVault);
      }
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  };

  const copyTimeoutRef = React.useRef<number | null>(null);

  const handleCopy = async (code: string, entryId: string) => {
    try {
      // Remove space before copying
      const rawCode = code.replace(/\s+/g, "");
      await navigator.clipboard.writeText(rawCode);
      setCopiedId(entryId);
      
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedId(null);
        copyTimeoutRef.current = null;
      }, 1000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Filter and sort accounts
  const filteredEntries = vault.entries
    .filter((entry) => {
      const q = search.toLowerCase();
      return (
        entry.issuer.toLowerCase().includes(q) ||
        entry.accountName.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aText = `${a.issuer} ${a.accountName}`.toLowerCase();
      const bText = `${b.issuer} ${b.accountName}`.toLowerCase();

      if (search) {
        // If searching, just sort alphabetically
        return aText.localeCompare(bText);
      }

      let aScore = 999;
      let bScore = 999;

      if (activeDomainKeywords.length > 0) {
        const aIndex = activeDomainKeywords.findIndex((kw) => aText.includes(kw));
        const bIndex = activeDomainKeywords.findIndex((kw) => bText.includes(kw));
        aScore = aIndex !== -1 ? aIndex : 999;
        bScore = bIndex !== -1 ? bIndex : 999;
      }

      if (aScore !== bScore) {
        return aScore - bScore; // Priority: subdomain (0) > domain (1) > rest (999)
      }

      // Alphabetical fallback
      return aText.localeCompare(bText);
    });

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-title-group">
          <LockIcon size={18} />
          <h1>Local Authenticator</h1>
        </div>
        <div className="header-actions">
          <button onClick={handleLock} className="btn-icon" title="Lock Vault">
            <LockIcon size={16} />
          </button>
          <button
            onClick={() => onNavigate("settings")}
            className="btn-icon"
            title="Settings"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="scrollable-content">
        <div className="search-bar">
          <SearchIcon size={16} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredEntries.length === 0 ? (
          <div className="empty-state">
            <LockIcon size={32} />
            {vault.entries.length === 0 ? (
              <>
                <h3>No Accounts Yet</h3>
                <p>Add your first 2FA account manually or import from Google Authenticator to get started.</p>
              </>
            ) : (
              <>
                <h3>No Matches</h3>
                <p>Try searching for a different keyword.</p>
              </>
            )}
          </div>
        ) : (
          <div className="account-list">
            {filteredEntries.map((entry) => (
              <AccountCard
                key={entry.id}
                entry={entry}
                timeSeconds={timeSeconds}
                onCopy={(code) => handleCopy(code, entry.id)}
                isCopied={copiedId === entry.id}
                onEdit={() => onNavigate("add_account", { editEntry: entry })}
                onDelete={() => handleDelete(entry.id)}
                onIncrementHotp={() => handleIncrementHotp(entry)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="bottom-actions">
        <button
          onClick={() => onNavigate("add_account")}
          className="btn btn-secondary flex justify-center align-center"
        >
          <PlusIcon size={14} /> Add Manual
        </button>
        <button
          onClick={() => onNavigate("import")}
          className="btn btn-primary flex justify-center align-center"
        >
          <ImportIcon size={14} /> Import QR
        </button>
      </div>
    </div>
  );
}

/* --- Internal Sub-components --- */

interface AccountCardProps {
  entry: VaultEntry;
  timeSeconds: number;
  onCopy: (code: string) => void;
  isCopied: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onIncrementHotp: () => void;
}

function AccountCard({
  entry,
  timeSeconds,
  onCopy,
  isCopied,
  onEdit,
  onDelete,
  onIncrementHotp,
}: AccountCardProps) {
  const [code, setCode] = useState("------");
  const [error, setError] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCooldown, setDeleteCooldown] = useState(0);
  const [copySource, setCopySource] = useState<"text" | "button" | null>(null);

  const handleCopyClick = (source: "text" | "button") => {
    if (!error) {
      setCopySource(source);
      onCopy(code);
    }
  };

  useEffect(() => {
    let timer: number;
    if (showConfirm && deleteCooldown > 0) {
      timer = window.setTimeout(() => {
        setDeleteCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => window.clearTimeout(timer);
  }, [showConfirm, deleteCooldown]);

  const handleShowConfirm = () => {
    setShowConfirm(true);
    setDeleteCooldown(3);
  };

  const handleCancelConfirm = () => {
    setShowConfirm(false);
    setDeleteCooldown(0);
  };

  const handleConfirmDelete = () => {
    setIsDeleting(true);
    setTimeout(() => {
      onDelete();
    }, 300); // Wait for CSS animation
  };

  // Compute remaining time for TOTP
  const period = entry.period || 30;
  const remaining = entry.type === "totp" ? period - (timeSeconds % period) : 0;

  // Retrieve code whenever time ticks or entry changes
  useEffect(() => {
    let active = true;
    async function updateCode() {
      try {
        let val = "";
        if (entry.type === "totp") {
          val = await generateTOTP(
            entry.secretBase32,
            timeSeconds,
            entry.period,
            entry.algorithm,
            entry.digits
          );
        } else {
          val = await generateHOTP(
            entry.secretBase32,
            entry.counter || 0,
            entry.algorithm,
            entry.digits
          );
        }
        if (active) {
          setCode(val);
          setError(false);
        }
      } catch (err) {
        console.error("Code generation error:", err);
        if (active) {
          setCode("ERROR");
          setError(true);
        }
      }
    }

    updateCode();
    return () => {
      active = false;
    };
  }, [entry, timeSeconds]);

  // Formatted display (e.g. 123 456 or 1234 5678)
  const formattedCode =
    code.length === 6
      ? `${code.substring(0, 3)} ${code.substring(3)}`
      : code.length === 8
      ? `${code.substring(0, 4)} ${code.substring(4)}`
      : code;

  return (
    <div className={`account-card ${isDeleting ? "deleting" : ""}`}>
      {showConfirm && (
        <div className="delete-confirm-overlay" style={{ backgroundColor: "var(--surface)" }}>
          <span style={{ fontSize: "12px", fontWeight: 600 }}>Delete this account?</span>
          <button onClick={handleCancelConfirm} className="btn btn-secondary" style={{ padding: "4px 8px" }}>Cancel</button>
          <button 
            onClick={handleConfirmDelete} 
            className="btn btn-danger" 
            style={{ padding: "4px 8px" }}
            disabled={deleteCooldown > 0}
          >
            {deleteCooldown > 0 ? `Wait (${deleteCooldown}s)` : "Delete"}
          </button>
        </div>
      )}
      
      <div className="card-top">
        <div className="account-info">
          <div className="account-issuer">{entry.issuer}</div>
          <div className="account-name">{entry.accountName}</div>
        </div>
        <div className="card-actions">
          <button onClick={onEdit} className="btn-icon" title="Edit">
            <EditIcon size={13} />
          </button>
          <button onClick={handleShowConfirm} className="btn-icon" title="Delete">
            <TrashIcon size={13} />
          </button>
        </div>
      </div>

      <div className="card-bottom">
        <div className="flex align-center gap-8">
          <span style={{ position: "relative" }}>
            {isCopied && copySource === "text" && (
              <span className="copied-toast" style={{ position: "absolute", bottom: "100%", left: "50%", marginBottom: "4px", zIndex: 10 }}>
                Copied
              </span>
            )}
            <span
              onClick={() => handleCopyClick("text")}
              className={`otp-code ${error ? "error" : ""}`}
              title="Click to copy"
            >
              {formattedCode}
            </span>
          </span>
          <button
            onClick={() => handleCopyClick("button")}
            className="btn-icon"
            style={{ padding: "4px", position: "relative" }}
            title="Copy Code"
            disabled={error}
          >
            {isCopied && copySource === "button" && (
              <span className="copied-toast" style={{ position: "absolute", bottom: "100%", left: "50%", marginBottom: "8px", zIndex: 10 }}>
                Copied
              </span>
            )}
            {isCopied ? <CheckIcon size={14} style={{ color: "var(--success)" }} /> : <CopyIcon size={14} />}
          </button>
        </div>

        <div className="countdown-container">
          {entry.type === "totp" ? (
            <>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                {remaining}s
              </span>
              <CountdownCircle remaining={remaining} period={period} />
            </>
          ) : (
            <button
              onClick={onIncrementHotp}
              className="btn btn-secondary"
              style={{ fontSize: "10px", padding: "4px 8px", borderRadius: "6px" }}
            >
              Increment ({entry.counter || 0})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CountdownCircle({ remaining, period }: { remaining: number; period: number }) {
  const radius = 6;
  const stroke = 1.8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (remaining / period) * circumference;

  return (
    <svg className="circular-progress" width="16" height="16">
      <circle
        stroke="var(--border)"
        fill="transparent"
        strokeWidth={stroke}
        r={radius}
        cx="8"
        cy="8"
      />
      <circle
        stroke={remaining <= 5 ? "var(--danger)" : "var(--accent)"}
        fill="transparent"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        style={{
          strokeDashoffset,
          transition: "stroke-dashoffset 1s linear, stroke 0.2s ease",
        }}
        r={radius}
        cx="8"
        cy="8"
        strokeLinecap="round"
      />
    </svg>
  );
}
