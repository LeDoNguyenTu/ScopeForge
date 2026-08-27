import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ReadableStream } from "node:stream/web";
import { describe, expect, it, vi } from "vitest";
import {
  downloadRepositoryScanArtifact,
  stageRepositoryScanSnapshot,
} from "@/packages/worker-supervisor/repository-scan-stager";

const SNAPSHOT_ID = "11111111-1111-4111-8111-111111111111";
const bytes = Buffer.from("scopeforge-phase6c-artifact", "utf8");
const digest = createHash("sha256").update(bytes).digest("hex");
const objectPath = `/repository-source/${"a".repeat(64)}.tar.gz`;
const descriptor = {
  method: "GET" as const,
  url: `https://scopeforge-source.${"b".repeat(32)}.r2.cloudflarestorage.com${objectPath}?X-Amz-Expires=60&X-Amz-Signature=${"c".repeat(64)}`,
  expiresAt: "2026-08-27T01:01:00.000Z",
};

function response(body: Buffer, contentLength: string | null = String(body.length)): Response {
  const headers = new Headers();
  if (contentLength !== null) headers.set("content-length", contentLength);
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    },
  }), { status: 200, headers });
}

describe("Phase 6C trusted snapshot stager", () => {
  it("downloads one exact bounded artifact with redirects disabled and verifies its digest", async () => {
    const work = await mkdtemp(path.join(tmpdir(), "scopeforge-scan-download-"));
    const destination = path.join(work, "snapshot.tar.gz");
    const fetchImpl = vi.fn(async () => response(bytes));
    try {
      await downloadRepositoryScanArtifact({
        descriptor,
        expectedHost: `scopeforge-source.${"b".repeat(32)}.r2.cloudflarestorage.com`,
        expectedBytes: bytes.length,
        expectedDigest: digest,
        destinationPath: destination,
        signal: new AbortController().signal,
      }, { fetch: fetchImpl as typeof fetch });

      expect(fetchImpl).toHaveBeenCalledWith(descriptor.url, {
        method: "GET",
        redirect: "manual",
        signal: expect.any(AbortSignal),
        headers: { accept: "application/gzip" },
      });
      expect(await readFile(destination)).toEqual(bytes);
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });

  it("rejects redirect, content-length mismatch, stream overflow, and digest mismatch without keeping partial files", async () => {
    const cases = [
      async () => new Response(null, { status: 302, headers: { location: "https://example.com/" } }),
      async () => response(bytes, String(bytes.length + 1)),
      async () => response(Buffer.concat([bytes, Buffer.from("overflow")])),
      async () => response(bytes),
    ];
    for (let index = 0; index < cases.length; index += 1) {
      const work = await mkdtemp(path.join(tmpdir(), "scopeforge-scan-reject-"));
      const destination = path.join(work, "snapshot.tar.gz");
      try {
        await expect(downloadRepositoryScanArtifact({
          descriptor,
          expectedHost: `scopeforge-source.${"b".repeat(32)}.r2.cloudflarestorage.com`,
          expectedBytes: bytes.length,
          expectedDigest: index === 3 ? "d".repeat(64) : digest,
          destinationPath: destination,
          signal: new AbortController().signal,
        }, { fetch: cases[index] as typeof fetch })).rejects.toThrow();
        await expect(readFile(destination)).rejects.toThrow();
      } finally {
        await rm(work, { recursive: true, force: true });
      }
    }
  });

  it("passes exact immutable snapshot provenance into the strict bundle reader and removes the archive after staging", async () => {
    const work = await mkdtemp(path.join(tmpdir(), "scopeforge-scan-stage-"));
    const materialize = vi.fn(async (input) => ({
      sourceDirectory: path.join(input.workDirectory, "materialized-source"),
      manifest: { contentDigest: input.expected.contentDigest },
    }));
    try {
      const result = await stageRepositoryScanSnapshot({
        workDirectory: work,
        artifact: {
          snapshotId: SNAPSHOT_ID,
          storedArtifactBytes: bytes.length,
          artifactDigest: digest,
          download: descriptor,
        },
        snapshot: {
          snapshotId: SNAPSHOT_ID,
          canonicalRepositoryUrl: "https://github.com/openai/openai-node",
          resolvedCommitSha: "e".repeat(40),
          contentDigest: "f".repeat(64),
          artifactDigest: digest,
          storedArtifactBytes: bytes.length,
          retainedFileCount: 2,
          retainedBytes: 20,
        },
        expectedHost: `scopeforge-source.${"b".repeat(32)}.r2.cloudflarestorage.com`,
        signal: new AbortController().signal,
      }, {
        fetch: vi.fn(async () => response(bytes)) as typeof fetch,
        materialize,
      });

      expect(materialize).toHaveBeenCalledWith(expect.objectContaining({
        artifactPath: path.join(work, "snapshot.tar.gz"),
        workDirectory: work,
        expected: {
          canonicalRepositoryUrl: "https://github.com/openai/openai-node",
          resolvedCommitSha: "e".repeat(40),
          contentDigest: "f".repeat(64),
          artifactDigest: digest,
          storedArtifactBytes: bytes.length,
          retainedFileCount: 2,
          retainedBytes: 20,
        },
      }));
      expect(result.snapshotId).toBe(SNAPSHOT_ID);
      await expect(readFile(path.join(work, "snapshot.tar.gz"))).rejects.toThrow();
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });
});