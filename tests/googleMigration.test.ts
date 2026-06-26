import { describe, it, expect } from "vitest";
import { parseMigrationText } from "../src/importers/googleAuthenticatorMigration";
import { uint8ArrayToBase64url } from "../src/crypto/encoding";

describe("Google Authenticator Migration Parser", () => {
  it("should successfully parse a valid binary migration payload", () => {
    // Construct a mock binary protobuf message for MigrationPayload
    // OtpParameters (Nested message, length 24 bytes):
    // - Tag 1 (secret, wire type 2): 0x0A, len 10: 0x0A, bytes: 1..10
    // - Tag 2 (name, wire type 2): 0x12, len 4: 0x04, bytes: "john" (106, 111, 104, 110)
    // - Tag 3 (issuer, wire type 2): 0x1A, len 4: 0x04, bytes: "ACME" (65, 67, 77, 69)
    //
    // Outer MigrationPayload:
    // - Tag 1 (otp_parameters, wire type 2): 0x0A, len 24: 0x18
    const protoBytes = new Uint8Array([
      0x0a, 0x18, // Outer tag 1, len 24
      0x0a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, // Inner tag 1 (secret), len 10
      0x12, 0x04, 106, 111, 104, 110, // Inner tag 2 (name), len 4 "john"
      0x1a, 0x04, 65, 67, 77, 69, // Inner tag 3 (issuer), len 4 "ACME"
    ]);

    const base64urlData = uint8ArrayToBase64url(protoBytes);
    const migrationUrl = `otpauth-migration://offline?data=${encodeURIComponent(base64urlData)}`;

    const entries = parseMigrationText(migrationUrl);

    expect(entries.length).toBe(1);
    const entry = entries[0];
    expect(entry.issuer).toBe("ACME");
    expect(entry.accountName).toBe("john");
    expect(entry.type).toBe("totp");
    expect(entry.algorithm).toBe("SHA1"); // protobuf unspecified falls back to SHA1
    expect(entry.digits).toBe(6); // protobuf unspecified falls back to 6
    expect(entry.secretBase32).toBe("AEBAGBAFAYDQQCIK"); // Base32 of [1,2,3,4,5,6,7,8,9,10]
  });

  it("should parse multiple mixed lines and ignore invalid ones", () => {
    const text = `
      otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub
      invalid-line-here
      otpauth://totp/Google:user2@example.com?secret=JBSWY3DPEHPK3PXP
    `;

    const entries = parseMigrationText(text);

    expect(entries.length).toBe(2);
    expect(entries[0].issuer).toBe("GitHub");
    expect(entries[1].issuer).toBe("Google");
  });

  it("should deduplicate parsed entries by issuer, account name, and secret", () => {
    const text = `
      otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP
      otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP
    `;

    const entries = parseMigrationText(text);
    expect(entries.length).toBe(1); // Should only keep one
  });
});
