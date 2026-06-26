import { describe, it, expect } from "vitest";
import { generateTOTP } from "../src/otp/totp";
import { generateHOTP } from "../src/otp/hotp";
import { parseOtpauthUri } from "../src/otp/otpauthUri";

describe("OTP Generation", () => {
  // RFC 6238 Test Vectors
  // SHA-1 Secret (20 bytes): "12345678901234567890"
  const secretSHA1 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  // SHA-256 Secret (32 bytes): "12345678901234567890123456789012"
  const secretSHA256 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA";
  // SHA-512 Secret (64 bytes): "1234567890123456789012345678901234567890123456789012345678901234"
  const secretSHA512 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA";

  it("should generate correct HOTP codes matching RFC 4226", async () => {
    // Check various counter values for SHA1 (6 digits)
    expect(await generateHOTP(secretSHA1, 0, "SHA1", 6)).toBe("755224");
    expect(await generateHOTP(secretSHA1, 1, "SHA1", 6)).toBe("287082");
    expect(await generateHOTP(secretSHA1, 2, "SHA1", 6)).toBe("359152");
    expect(await generateHOTP(secretSHA1, 3, "SHA1", 6)).toBe("969429");
  });

  it("should generate correct TOTP codes matching RFC 6238", async () => {
    // Test vectors for T = 59, 1111111109, 1111111111 (8 digits)
    expect(await generateTOTP(secretSHA1, 59, 30, "SHA1", 8)).toBe("94287082");
    expect(await generateTOTP(secretSHA256, 59, 30, "SHA256", 8)).toBe("46119246");
    expect(await generateTOTP(secretSHA512, 59, 30, "SHA512", 8)).toBe("90693936");

    expect(await generateTOTP(secretSHA1, 1111111109, 30, "SHA1", 8)).toBe("07081804");
    expect(await generateTOTP(secretSHA256, 1111111109, 30, "SHA256", 8)).toBe("68084774");
    expect(await generateTOTP(secretSHA512, 1111111109, 30, "SHA512", 8)).toBe("25091201");

    expect(await generateTOTP(secretSHA1, 1111111111, 30, "SHA1", 8)).toBe("14050471");
    expect(await generateTOTP(secretSHA256, 1111111111, 30, "SHA256", 8)).toBe("67062674");
    expect(await generateTOTP(secretSHA512, 1111111111, 30, "SHA512", 8)).toBe("99943326");
  });

  it("should correctly parse standard otpauth URIs", () => {
    const uri = "otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA256&digits=8&period=60";
    const parsed = parseOtpauthUri(uri);

    expect(parsed.type).toBe("totp");
    expect(parsed.issuer).toBe("GitHub");
    expect(parsed.accountName).toBe("user@example.com");
    expect(parsed.secretBase32).toBe("JBSWY3DPEHPK3PXP");
    expect(parsed.algorithm).toBe("SHA256");
    expect(parsed.digits).toBe(8);
    expect(parsed.period).toBe(60);
  });

  it("should fallback to default values in otpauth URIs if missing", () => {
    const uri = "otpauth://totp/user@example.com?secret=JBSWY3DPEHPK3PXP";
    const parsed = parseOtpauthUri(uri);

    expect(parsed.type).toBe("totp");
    expect(parsed.issuer).toBe("");
    expect(parsed.accountName).toBe("user@example.com");
    expect(parsed.secretBase32).toBe("JBSWY3DPEHPK3PXP");
    expect(parsed.algorithm).toBe("SHA1");
    expect(parsed.digits).toBe(6);
    expect(parsed.period).toBe(30);
  });
});
