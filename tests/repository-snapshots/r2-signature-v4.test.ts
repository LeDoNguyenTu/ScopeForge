import { describe, expect, it } from "vitest";
import {
  createPresignedR2PutUrl,
  createSignedR2Request,
} from "@/lib/repository-snapshots/r2-signature-v4";

const credentials = {
  accountId: "0123456789abcdef0123456789abcdef",
  accessKeyId: "TESTACCESSKEY1234567890",
  secretAccessKey: "test-secret-access-key-that-is-not-real",
  bucket: "scopeforge-artifacts",
};
const now = new Date("2026-08-27T00:00:00.000Z");
const objectKey = `repository-source/${"a".repeat(64)}.tar.gz`;

describe("Phase 6B R2 SigV4", () => {
  it("creates deterministic PUT-only presigned URLs scoped to one object", () => {
    const first = createPresignedR2PutUrl({ credentials, objectKey, expiresInSeconds: 360, now });
    const second = createPresignedR2PutUrl({ credentials, objectKey, expiresInSeconds: 360, now });

    expect(first).toBe(second);
    const url = new URL(first);
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe(`scopeforge-artifacts.${credentials.accountId}.r2.cloudflarestorage.com`);
    expect(url.pathname).toBe(`/${objectKey}`);
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toBe(`${credentials.accessKeyId}/20260827/auto/s3/aws4_request`);
    expect(url.searchParams.get("X-Amz-Date")).toBe("20260827T000000Z");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("360");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects overlong expiry and unsafe object keys", () => {
    expect(() => createPresignedR2PutUrl({ credentials, objectKey, expiresInSeconds: 361, now })).toThrow();
    for (const badKey of [
      "repository-source/../escape.tar.gz",
      "repository-source/not-a-digest.tar.gz",
      `other/${"a".repeat(64)}.tar.gz`,
    ]) {
      expect(() => createPresignedR2PutUrl({ credentials, objectKey: badKey, expiresInSeconds: 60, now })).toThrow();
    }
  });

  it("signs only the reviewed HEAD and DELETE operations", () => {
    for (const method of ["HEAD", "DELETE"] as const) {
      const signed = createSignedR2Request({ credentials, method, objectKey, now });
      expect(signed.url).toBe(`https://scopeforge-artifacts.${credentials.accountId}.r2.cloudflarestorage.com/${objectKey}`);
      expect(signed.headers.host).toBe(`scopeforge-artifacts.${credentials.accountId}.r2.cloudflarestorage.com`);
      expect(signed.headers["x-amz-date"]).toBe("20260827T000000Z");
      expect(signed.headers["x-amz-content-sha256"]).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
      expect(signed.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=/);
    }
  });
});
