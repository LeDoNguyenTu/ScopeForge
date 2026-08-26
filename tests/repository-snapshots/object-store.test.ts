import { describe, expect, it, vi } from "vitest";
import { createR2RepositorySnapshotObjectStore } from "@/lib/repository-snapshots/r2-object-store";

const config = {
  accountId: "0123456789abcdef0123456789abcdef",
  accessKeyId: "TESTACCESSKEY1234567890",
  secretAccessKey: "test-secret-access-key-that-is-not-real",
  bucket: "scopeforge-artifacts",
};
const objectKey = `repository-source/${"a".repeat(64)}.tar.gz`;

describe("Phase 6B repository snapshot object store", () => {
  it("issues one bounded PUT authorization without exposing credentials", async () => {
    const store = createR2RepositorySnapshotObjectStore({
      config,
      now: () => new Date("2026-08-27T00:00:00.000Z"),
      fetch: vi.fn(),
    });

    const result = await store.createAttemptUpload({
      objectKey,
      expiresAt: new Date("2026-08-27T00:06:00.000Z"),
    });

    expect(result.method).toBe("PUT");
    expect(result.expiresAt).toBe("2026-08-27T00:06:00.000Z");
    expect(result.url).toContain("X-Amz-Signature=");
    expect(result.url).not.toContain(config.secretAccessKey);
  });

  it("uses redirect-free HEAD and returns exact content length", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 200,
      headers: { "content-length": "12345" },
    }));
    const store = createR2RepositorySnapshotObjectStore({ config, fetch: fetchMock });

    await expect(store.headObject(objectKey)).resolves.toEqual({ exists: true, size: 12345 });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "HEAD", redirect: "manual" });
  });

  it("maps missing HEAD to exists=false and rejects malformed sizes", async () => {
    const missing = createR2RepositorySnapshotObjectStore({
      config,
      fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    });
    await expect(missing.headObject(objectKey)).resolves.toEqual({ exists: false, size: null });

    const malformed = createR2RepositorySnapshotObjectStore({
      config,
      fetch: vi.fn().mockResolvedValue(new Response(null, {
        status: 200,
        headers: { "content-length": "not-a-number" },
      })),
    });
    await expect(malformed.headObject(objectKey)).rejects.toThrow();
  });

  it("deletes one exact object with redirects disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const store = createR2RepositorySnapshotObjectStore({ config, fetch: fetchMock });

    await expect(store.deleteObject(objectKey)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "DELETE", redirect: "manual" });
  });
});
