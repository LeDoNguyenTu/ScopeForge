import { describe, expect, it } from "vitest";
import { isBlockedAddress, normalizeAssetTarget } from "@/lib/assets/normalize-target";

describe("hosted verification address boundaries", () => {
  it.each([
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:c0a8:0101",
    "192.0.2.10",
    "198.51.100.8",
    "203.0.113.9"
  ])("blocks non-public address %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it("keeps public IP addresses eligible", () => {
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("2001:4860:4860::8888")).toBe(false);
  });

  it("rejects non-standard hosted verification ports", () => {
    expect(() => normalizeAssetTarget("https://example.com:8443", "web_application"))
      .toThrow(/port 443/i);
  });
});
