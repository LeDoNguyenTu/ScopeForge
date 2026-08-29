import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { materializeRepositorySnapshotBundle } from "@/packages/repository-snapshot";
import { createTestTarGzip, paxRecord, type TestTarEntry } from "./tar-fixtures";

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function expectUnsafe(entries: readonly TestTarEntry[], pattern: RegExp) {
  const directory = await mkdtemp(path.join(tmpdir(), "scopeforge-reader-hostile-"));
  try {
    const bytes = createTestTarGzip(entries);
    const artifactPath = path.join(directory, "snapshot.tar.gz");
    await writeFile(artifactPath, bytes);
    await expect(materializeRepositorySnapshotBundle({
      artifactPath,
      workDirectory: directory,
      expected: {
        canonicalRepositoryUrl: "https://github.com/octocat/Hello-World",
        resolvedCommitSha: "a".repeat(40),
        contentDigest: "b".repeat(64),
        artifactDigest: sha256(bytes),
        storedArtifactBytes: bytes.length,
        retainedFileCount: 0,
        retainedBytes: 0,
      },
      signal: new AbortController().signal,
    })).rejects.toThrow(pattern);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("Phase 6C hostile snapshot bundle rejection", () => {
  it("rejects traversal, absolute, backslash, links, and special entries", async () => {
    await expectUnsafe([{ name: "../escape", body: Buffer.from("x") }], /traversal|path/i);
    await expectUnsafe([{ name: "/absolute", body: Buffer.from("x") }], /absolute|path/i);
    await expectUnsafe([{ name: "a\\b", body: Buffer.from("x") }], /backslash|path/i);
    await expectUnsafe([{ name: "link", type: "2" }], /regular|entry type|link/i);
    await expectUnsafe([{ name: "device", type: "3" }], /regular|entry type|special/i);
  });

  it("rejects unreviewed PAX metadata and a manifest that is not the final logical file", async () => {
    await expectUnsafe([
      { name: "PaxHeaders/x", type: "x", body: paxRecord("mtime", "123") },
      { name: "PaxFiles/x", body: Buffer.from("x") },
    ], /pax/i);

    await expectUnsafe([
      { name: ".scopeforge/snapshot-manifest-v1.json", body: Buffer.from("{}") },
      { name: "after.txt", body: Buffer.from("x") },
    ], /manifest|final/i);
  });

  it("rejects duplicate or file-shadowing paths before manifest trust", async () => {
    await expectUnsafe([
      { name: "same.txt", body: Buffer.from("one") },
      { name: "same.txt", body: Buffer.from("two") },
    ], /duplicate/i);

    await expectUnsafe([
      { name: "a", body: Buffer.from("one") },
      { name: "a/b", body: Buffer.from("two") },
    ], /shadow|path/i);
  });
});