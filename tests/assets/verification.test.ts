import { lookup } from "node:dns/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createVerificationChallenge,
  hashVerificationToken,
  verifyHttpWellKnownTarget
} from "@/lib/assets/verification";

vi.mock("node:dns/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:dns/promises")>();
  return { ...actual, lookup: vi.fn() };
});

const mockedLookup = vi.mocked(lookup);

function setFetch(response: Response) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockedLookup.mockReset();
    mockedLookup.mockResolvedValue([{ address: "203.0.113.10", family: 4 }] as never);
  });

  it("accepts an exact token from the well-known path", async () => {
    setFetch(new Response("scopeforge-token", { status: 200, headers: { "content-type": "text/plain" } }));
    await expect(verifyHttpWellKnownTarget({ canonicalTarget: "https://example.com/app", expectedToken: "scopeforge-token" }))
      .resolves.toEqual({ verified: true, reason: "Proof of control verified." });
    expect(fetch).toHaveBeenCalledWith(new URL("https://example.com/.well-known/scopeforge-verification.txt"), expect.objectContaining({ redirect: "manual" }));
  });

  it("rejects a missing verification file", async () => {
    setFetch(new Response("not found", { status: 404 }));
    const result = await verifyHttpWellKnownTarget({ canonicalTarget: "https://example.com", expectedToken: "token" });
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/HTTP 404/);
  });

  it("rejects the wrong token", async () => {
    setFetch(new Response("wrong", { status: 200 }));
    const result = await verifyHttpWellKnownTarget({ canonicalTarget: "https://example.com", expectedToken: "expected" });
    expect(result).toEqual({ verified: false, reason: "Verification file did not contain the expected token." });
  });

  it("rejects redirects to another hostname", async () => {
    setFetch(new Response(null, { status: 302, headers: { location: "https://attacker.example/token" } }));
    const result = await verifyHttpWellKnownTarget({ canonicalTarget: "https://example.com", expectedToken: "token" });
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/another hostname/i);
  });

  it("rejects DNS resolution to private addresses before fetch", async () => {
    mockedLookup.mockResolvedValueOnce([{ address: "10.0.0.7", family: 4 }] as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await verifyHttpWellKnownTarget({ canonicalTarget: "https://example.com", expectedToken: "token" });
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/private or local/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized verification body", async () => {
    setFetch(new Response("x".repeat(4097), { status: 200 }));
    const result = await verifyHttpWellKnownTarget({ canonicalTarget: "https://example.com", expectedToken: "token" });
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/larger than 4 KiB/i);
  });

  it("turns timeout errors into a safe failure", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    const result = await verifyHttpWellKnownTarget({ canonicalTarget: "https://example.com", expectedToken: "token" });
    expect(result).toEqual({ verified: false, reason: "Verification request timed out." });
  });
});
