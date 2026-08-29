import { describe, expect, it } from "vitest";
import { createPresignedR2GetUrl } from "@/lib/repository-snapshots/r2-signature-v4";

const credentials = {
  accountId: "a".repeat(32),
  accessKeyId: "SCOPEFORGEACCESSKEY",
  secretAccessKey: "scopeforge-test-secret-access-key",
  bucket: "scopeforge-repository-source",
};
const objectKey = `repository-source/${"b".repeat(64)}.tar.gz`;
const now = new Date("2026-08-27T00:30:00.000Z");

describe("Phase 6C R2 snapshot GET signing", () => {
  it("signs only the exact immutable repository-source object for at most 120 seconds", () => {
    const signed = createPresignedR2GetUrl({
      credentials,
      objectKey,
      expiresInSeconds: 120,
      now,
    });
    const url = new URL(signed);

    expect(url.protocol).toBe("https:");
    expect(url.port).toBe("");
    expect(url.hostname).toBe(
      "scopeforge-repository-source.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com",
    );
    expect(url.pathname).toBe(`/${objectKey}`);
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("120");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(signed).not.toContain(credentials.secretAccessKey);
  });

  it("rejects overlong authorization and any non-snapshot object key", () => {
    expect(() => createPresignedR2GetUrl({
      credentials,
      objectKey,
      expiresInSeconds: 121,
      now,
    })).toThrow(/expiry/i);
    expect(() => createPresignedR2GetUrl({
      credentials,
      objectKey: "other-prefix/object.tar.gz",
      expiresInSeconds: 60,
      now,
    })).toThrow(/object key/i);
  });
});