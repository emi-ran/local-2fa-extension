import { describe, it, expect } from "vitest";
import { encodeBase32, decodeBase32 } from "../src/crypto/base32";

describe("Base32 Coding", () => {
  it("should encode standard byte sequences to Base32", () => {
    const encoder = new TextEncoder();
    expect(encodeBase32(encoder.encode("Hello!!!!!"))).toBe("JBSWY3DPEEQSCIJB");
    expect(encodeBase32(encoder.encode(""))).toBe("");
  });

  it("should decode Base32 strings back to original bytes", () => {
    const decoded = decodeBase32("JBSWY3DPEEQSCIJB");
    const decoder = new TextDecoder();
    expect(decoder.decode(decoded)).toBe("Hello!!!!!");
    expect(decodeBase32("").length).toBe(0);
  });

  it("should handle spaces, hyphens, and padding correctly", () => {
    const decoded = decodeBase32("JBSW-Y3DP EEQS-CIJB ===");
    const decoder = new TextDecoder();
    expect(decoder.decode(decoded)).toBe("Hello!!!!!");
  });

  it("should throw error on invalid Base32 characters", () => {
    expect(() => decodeBase32("JBSWY3DPEHPK3PX8")).toThrow(); // 8 is invalid
    expect(() => decodeBase32("JBSWY3DPEHPK3PX#")).toThrow(); // # is invalid
  });
});
