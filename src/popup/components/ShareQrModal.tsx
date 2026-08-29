import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  CloseIcon,
  CopyIcon,
  CheckIcon,
  QrCodeIcon,
  KeyIcon,
} from "./Icons";
import { buildOtpauthUri } from "../../otp/otpauthUri";
import type { VaultEntry } from "../../types/vault";

interface ShareQrModalProps {
  entry: VaultEntry;
  onClose: () => void;
}

export default function ShareQrModal({ entry, onClose }: ShareQrModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [copiedField, setCopiedField] = useState<"uri" | "secret" | null>(null);

  const otpUri = buildOtpauthUri(entry);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    QRCode.toDataURL(otpUri, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 220,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (active) {
          setQrDataUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("QR Code generation error:", err);
        if (active) {
          setError("QR code could not be generated.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [otpUri]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleCopy = (text: string, field: "uri" | "secret") => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField((prev) => (prev === field ? null : prev));
    }, 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-modal-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <QrCodeIcon size={16} />
            </div>
            <div>
              <h3 id="qr-modal-title" className="modal-title">
                Share Account
              </h3>
              <p className="modal-subtitle">Scan with Google Authenticator</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            title="Close"
            aria-label="Close"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Account Info Pill */}
        <div className="modal-account-pill">
          <span className="account-pill-issuer">{entry.issuer || "Account"}</span>
          <span className="account-pill-name">{entry.accountName}</span>
        </div>

        {/* QR Code Container */}
        <div className="qr-box-wrapper">
          {loading ? (
            <div className="qr-loading-placeholder">
              <div className="spinner" />
              <span>Generating QR Code...</span>
            </div>
          ) : error ? (
            <div className="qr-error-placeholder">
              <p>{error}</p>
            </div>
          ) : (
            <div className="qr-image-frame">
              <img
                src={qrDataUrl}
                alt={`QR code for ${entry.issuer || entry.accountName}`}
                className="qr-image"
              />
            </div>
          )}
        </div>

        <p className="qr-instruction-text">
          Google Authenticator veya uyumlu 2FA uygulamasıyla bu kodu tarayarak hesabınızı ekleyebilirsiniz.
        </p>

        {/* Meta Info Badges */}
        <div className="qr-meta-row">
          <span className="meta-badge">{entry.type.toUpperCase()}</span>
          <span className="meta-badge">{entry.digits} Digits</span>
          <span className="meta-badge">{entry.algorithm}</span>
          {entry.type === "totp" ? (
            <span className="meta-badge">{entry.period || 30}s</span>
          ) : (
            <span className="meta-badge">Counter: {entry.counter || 0}</span>
          )}
        </div>

        {/* Copy Actions */}
        <div className="modal-actions-list">
          <button
            onClick={() => handleCopy(otpUri, "uri")}
            className="btn btn-secondary modal-action-btn"
            title="Copy standard otpauth URI"
          >
            {copiedField === "uri" ? (
              <>
                <CheckIcon size={14} style={{ color: "var(--success)" }} /> Copied URI!
              </>
            ) : (
              <>
                <CopyIcon size={14} /> Copy URI
              </>
            )}
          </button>
          <button
            onClick={() => handleCopy(entry.secretBase32, "secret")}
            className="btn btn-secondary modal-action-btn"
            title="Copy Base32 Secret Key"
          >
            {copiedField === "secret" ? (
              <>
                <CheckIcon size={14} style={{ color: "var(--success)" }} /> Copied Secret!
              </>
            ) : (
              <>
                <KeyIcon size={14} /> Copy Secret
              </>
            )}
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="btn btn-primary w-100 mt-2"
          style={{ width: "100%" }}
        >
          Done / Tamam
        </button>
      </div>
    </div>
  );
}
