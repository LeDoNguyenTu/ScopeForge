import { describe, expect, it, vi } from "vitest";
import { resolvePinnedRuntimeAddress } from "@/packages/runtime-observer";

describe("runtime DNS resolution", () => {
  it("selects a deterministic public address", async () => {
    const resolver = {
      resolve: vi.fn(async () => ["8.8.8.8", "1.1.1.1", "8.8.8.8"]),
    };

    await expect(resolvePinnedRuntimeAddress("example.com", resolver)).resolves.toEqual({
      address: "1.1.1.1",
      family: 4,
    });
    expect(resolver.resolve).toHaveBeenCalledWith("example.com");
  });

  it("fails closed when DNS mixes public and blocked addresses", async () => {
    const resolver = {
      resolve: vi.fn(async () => ["8.8.8.8", "10.0.0.5"]),
    };

    await expect(resolvePinnedRuntimeAddress("example.com", resolver)).rejects.toThrow(/blocked address/i);
  });

  it("performs a fresh resolver call for every connection attempt", async () => {
    const resolver = {
      resolve: vi.fn(async () => ["1.1.1.1"]),
    };

    await resolvePinnedRuntimeAddress("example.com", resolver);
    await resolvePinnedRuntimeAddress("example.com", resolver);

    expect(resolver.resolve).toHaveBeenCalledTimes(2);
  });
});
