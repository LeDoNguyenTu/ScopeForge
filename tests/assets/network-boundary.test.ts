import { describe, expect, it } from "vitest";
import { isBlockedNetworkAddress } from "@/lib/assets/network-boundary";

describe("isBlockedNetworkAddress", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "::ffff:127.0.0.1"])(
    "blocks local or special address %s",
    (address) => expect(isBlockedNetworkAddress(address)).toBe(true)
  );

  it.each(["8.8.8.8", "1.1.1.1", "2001:4860:4860::8888"])(
    "allows public address %s",
    (address) => expect(isBlockedNetworkAddress(address)).toBe(false)
  );
});
