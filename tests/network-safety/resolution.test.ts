import { describe, expect, it } from "vitest";
import {
  normalizePublicResolvedAddresses,
  selectPinnedPublicAddress,
} from "@/packages/network-safety";

describe("resolved address safety", () => {
  it("normalizes, de-duplicates, and sorts public addresses deterministically", () => {
    expect(normalizePublicResolvedAddresses(["8.8.8.8", "1.1.1.1", "8.8.8.8"])).toEqual([
      { address: "1.1.1.1", family: 4 },
      { address: "8.8.8.8", family: 4 },
    ]);
  });

  it("rejects the entire resolution when any address is blocked", () => {
    expect(() => normalizePublicResolvedAddresses(["1.1.1.1", "127.0.0.1"])).toThrow(
      "Target resolves to a private, local, reserved, or otherwise blocked address.",
    );
  });

  it("rejects invalid DNS addresses", () => {
    expect(() => normalizePublicResolvedAddresses(["not-an-ip"])).toThrow(
      "Target DNS returned an invalid address.",
    );
  });

  it("rejects empty DNS results", () => {
    expect(() => selectPinnedPublicAddress([])).toThrow("Target hostname did not resolve.");
  });
});
