import { describe, expect, it, vi } from "vitest";
import {
  createVerificationChallenge,
  hashVerificationToken,
  verifyHttpWellKnownTarget
} from "@/lib/assets/verification";

function publicResolver() {
  return vi.fn(async () => ["203.0.113.10"]);
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
  it("accepts an exact token from the well-known path", async () => {
    const resolveHostname = publicResolver();
    const fetcher = vi.fn().mockResolvedValue(
      new Response("scopeforge-token", { status: 200, headers: { "content-type": "text/plain" } })
    );

    await expect(
      verifyHttpWellKnownTarget(
        { canonicalTarget: "https://example.com/app", expectedToken: "scopeforge-token" },
        { resolveHostname, fetcher }
      )
    ).resolves.toEqual({ verified: true, reason: "Proof of control verified." });

    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://example.com/.well-known/scopeforge-verification.txt"),
      expect.objectContaining({ redirect: "manual" })
    );
    expect(resolveHostname).toHaveBeenCalledTimes(2);
  });

  it("rejects a missing verification file", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("not found", { status: 404 }));
    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "token" },
      { resolveHostname: publicResolver(), fetcher }
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/HTTP 404/);
  });

  it("rejects the wrong token", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("wrong", { status: 200 }));
    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "expected" },
      { resolveHostname: publicResolver(), fetcher }
    );
    expect(result).toEqual({ verified: false, reason: "Verification file did not contain the expected token." });
  });

  it("rejects redirects to another hostname", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "https://attacker.example/token" } })
    );
    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "token" },
      { resolveHostname: publicResolver(), fetcher }
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/another hostname/i);
  });

  it("rejects DNS resolution to private addresses before fetch", async () => {
    const fetcher = vi.fn();
    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "token" },
      { resolveHostname: async () => ["10.0.0.7"], fetcher }
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/private or local/i);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects DNS changes during verification", async () => {
    const resolveHostname = vi.fn()
      .mockResolvedValueOnce(["203.0.113.10"])
      .mockResolvedValueOnce(["203.0.113.11"]);
    const fetcher = vi.fn().mockResolvedValue(new Response("scopeforge-token", { status: 200 }));

    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "scopeforge-token" },
      { resolveHostname, fetcher }
    );

    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/DNS changed/i);
  });

  it("rejects an oversized verification body", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("x".repeat(4097), { status: 200 }));
    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "token" },
      { resolveHostname: publicResolver(), fetcher }
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/larger than 4 KiB/i);
  });

  it("turns timeout errors into a safe failure", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    const fetcher = vi.fn().mockRejectedValue(timeout);
    const result = await verifyHttpWellKnownTarget(
      { canonicalTarget: "https://example.com", expectedToken: "token" },
      { resolveHostname: publicResolver(), fetcher }
    );
    expect(result).toEqual({ verified: false, reason: "Verification request timed out." });
  });
});
