import { describe, expect, it } from "vitest";
import { isBlockedNetworkAddress } from "@/packages/network-safety";

describe("network safety IP policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "100.64.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks non-public address %s", (address) => {
    expect(isBlockedNetworkAddress(address)).toBe(true);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows representative public address %s",
    (address) => {
      expect(isBlockedNetworkAddress(address)).toBe(false);
    },
  );
});
