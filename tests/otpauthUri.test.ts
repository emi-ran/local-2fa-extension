import { describe, it, expect } from "vitest";
import { buildOtpauthUri, parseOtpauthUri } from "../src/otp/otpauthUri";

describe("buildOtpauthUri & parseOtpauthUri", () => {
  it("builds standard totp uri for Google Authenticator", () => {
    const entry = {
      type: "totp",
      issuer: "Google",
      accountName: "user@example.com",
      secretBase32: "JBSWY3DPEHPK3PXP",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    };

    const uri = buildOtpauthUri(entry);
    expect(uri).toBe("otpauth://totp/Google:user%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Google");

    const parsed = parseOtpauthUri(uri);
    expect(parsed.type).toBe("totp");
    expect(parsed.issuer).toBe("Google");
    expect(parsed.accountName).toBe("user@example.com");
    expect(parsed.secretBase32).toBe("JBSWY3DPEHPK3PXP");
    expect(parsed.algorithm).toBe("SHA1");
    expect(parsed.digits).toBe(6);
    expect(parsed.period).toBe(30);
  });

  it("handles non-default algorithm, digits, and period", () => {
    const entry = {
      type: "totp",
      issuer: "Acme Corp",
      accountName: "admin",
      secretBase32: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ",
      algorithm: "SHA256",
      digits: 8,
      period: 60,
    };

    const uri = buildOtpauthUri(entry);
    expect(uri).toContain("algorithm=SHA256");
    expect(uri).toContain("digits=8");
    expect(uri).toContain("period=60");

    const parsed = parseOtpauthUri(uri);
    expect(parsed.issuer).toBe("Acme Corp");
    expect(parsed.accountName).toBe("admin");
    expect(parsed.algorithm).toBe("SHA256");
    expect(parsed.digits).toBe(8);
    expect(parsed.period).toBe(60);
  });

  it("handles hotp with counter", () => {
    const entry = {
      type: "hotp",
      issuer: "GitHub",
      accountName: "dev",
      secretBase32: "JBSWY3DPEHPK3PXP",
      counter: 42,
    };

    const uri = buildOtpauthUri(entry);
    expect(uri).toContain("counter=42");

    const parsed = parseOtpauthUri(uri);
    expect(parsed.type).toBe("hotp");
    expect(parsed.counter).toBe(42);
  });

  it("handles empty issuer gracefully", () => {
    const entry = {
      type: "totp",
      accountName: "standalone",
      secretBase32: "JBSWY3DPEHPK3PXP",
    };

    const uri = buildOtpauthUri(entry);
    expect(uri).toBe("otpauth://totp/standalone?secret=JBSWY3DPEHPK3PXP");

    const parsed = parseOtpauthUri(uri);
    expect(parsed.accountName).toBe("standalone");
    expect(parsed.secretBase32).toBe("JBSWY3DPEHPK3PXP");
  });
});
