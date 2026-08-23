import { describe, expect, it, vi } from "vitest";
import {
  createVerificationChallenge,
  hashVerificationToken,
  verifyHttpWellKnownTarget
} from "@/lib/assets/verification";

function publicResolver() {
  return vi.fn(async () => ["8.8.8.8"]);
}

describe("verification challenge", () => {
  it("generates a high-entropy token and stores only its SHA-256 hash", () => {
    const first = createVerificationChallenge();
    const second = createVerificationChallenge();
    expect(first.token).not.toBe(second.token);
    expect(first.token.length).toBeGreaterThanOrEqual(40);
    expect(first.tokenHash).toBe(hashVerificationToken(first.token));
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("expires challenges approximately 30 minutes from creation", () => {
    const before = Date.now();
    const challenge = createVerificationChallenge();
    const ttl = challenge.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(29 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(31 * 60 * 1000);
  });
});

describe("verifyHttpWellKnownTarget", () => {
  it("pins the request to a prevalidated public address", async () => {
    const resolveHostname = publicResolver();
    const requester = vi.fn().mockResolvedValue({ status: 200, location: null, body: "scopeforge-token" });

    await expect(
      verifyHttpWellKnownTarget(
        { canonicalTarget: "https://example.com/app", expectedToken: "scopeforge-token" },
        { resolveHostname, requester }
      )
    ).resolves.toEqual({ verified: true, reason: "Proof of control verified." });

    expect(requester).toHaveBeenCalledWith({
      endpoint: new URL("https://example.com/.well-known/scopeforge-verification.txt"),
      address: "8.8.8.8",
      family: 4
    });
    expect(resolveHostname).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing verification file", async () => {
    const requester = vi.fn().mockResolvedValue({ status: 404, location: null, body: "not found" });
    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "token" },
      { resolveHostname: publicResolver(), requester }
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/HTTP 404/);
  });

  it("rejects the wrong token", async () => {
    const requester = vi.fn().mockResolvedValue({ status: 200, location: null, body: "wrong" });
    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "expected" },
      { resolveHostname: publicResolver(), requester }
    );
    expect(result).toEqual({ verified: false, reason: "Verification file did not contain the expected token." });
  });

  it("rejects redirects to another hostname", async () => {
    const requester = vi.fn().mockResolvedValue({ status: 302, location: "https://attacker.example/token", body: "" });
    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "token" },
      { resolveHostname: publicResolver(), requester }
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/another hostname/i);
  });

  it("rejects any private address in DNS results before opening a socket", async () => {
    const requester = vi.fn();
    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "token" },
      { resolveHostname: async () => ["8.8.8.8", "10.0.0.7"], requester }
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/private or local/i);
    expect(requester).not.toHaveBeenCalled();
  });

  it("rejects IPv4-mapped IPv6 loopback before opening a socket", async () => {
    const requester = vi.fn();
    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "token" },
      { resolveHostname: async () => ["::ffff:127.0.0.1"], requester }
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/private or local/i);
    expect(requester).not.toHaveBeenCalled();
  });

  it("rejects an oversized verification body", async () => {
    const requester = vi.fn().mockResolvedValue({ status: 200, location: null, body: "x".repeat(4097) });
    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "token" },
      { resolveHostname: publicResolver(), requester }
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/larger than 4 KiB/i);
  });

  it("turns timeout errors into a safe failure", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    const requester = vi.fn().mockRejectedValue(timeout);
    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "token" },
      { resolveHostname: publicResolver(), requester }
    );
    expect(result).toEqual({ verified: false, reason: "Verification request timed out." });
  });
});
