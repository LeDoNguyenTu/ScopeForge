import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  materializeRepositorySnapshotBundle,
  writeRepositorySnapshotBundle,
} from "@/packages/repository-snapshot";
import type {
  RepositorySnapshotSkipCounts,
  ScratchRepositoryFile,
} from "@/packages/repository-snapshot";

const zeroSkips: RepositorySnapshotSkipCounts = {
  symlink: 0,
  hardlink: 0,
  fileTooLarge: 0,
  retainedFileLimit: 0,
  retainedBytesLimit: 0,
};

function digest(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function sourceFile(directory: string, repositoryPath: string, text: string): Promise<ScratchRepositoryFile> {
  const bytes = Buffer.from(text, "utf8");
  const scratchPath = path.join(directory, `${digest(Buffer.from(repositoryPath)).slice(0, 16)}.blob`);
  await writeFile(scratchPath, bytes, { flag: "wx", mode: 0o600 });
  return { path: repositoryPath, scratchPath, size: bytes.length, sha256: digest(bytes) };
}

describe("Phase 6C immutable snapshot reader", () => {
  it("reverifies artifact, manifest, and every file before exposing a read-only source tree", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "scopeforge-reader-test-"));
    try {
      const sourceWork = path.join(directory, "writer");
      const readerWork = path.join(directory, "reader");
      await writeFile(path.join(directory, "placeholder"), "x");
      await import("node:fs/promises").then(({ mkdir }) => Promise.all([
        mkdir(sourceWork),
        mkdir(readerWork),
      ]));
      const files = [
        await sourceFile(sourceWork, "src/index.ts", "export const answer = 42;\n"),
        await sourceFile(sourceWork, "README.md", "# Safe snapshot\n"),
      ];
      const bundle = await writeRepositorySnapshotBundle({
        files,
        source: {
          canonicalRepositoryUrl: "https://github.com/octocat/Hello-World",
          defaultBranch: "master",
          resolvedCommitSha: "a".repeat(40),
        },
        skipCounts: zeroSkips,
        workDirectory: sourceWork,
        signal: new AbortController().signal,
      });

      const materialized = await materializeRepositorySnapshotBundle({
        artifactPath: bundle.artifactPath,
        workDirectory: readerWork,
        expected: {
          canonicalRepositoryUrl: "https://github.com/octocat/Hello-World",
          resolvedCommitSha: "a".repeat(40),
          contentDigest: bundle.contentDigest,
          artifactDigest: bundle.artifactDigest,
          storedArtifactBytes: bundle.storedArtifactBytes,
          retainedFileCount: 2,
          retainedBytes: files.reduce((sum, file) => sum + file.size, 0),
        },
        signal: new AbortController().signal,
      });

      expect(await readFile(path.join(materialized.sourceDirectory, "src/index.ts"), "utf8"))
        .toBe("export const answer = 42;\n");
      expect(await readFile(path.join(materialized.sourceDirectory, "README.md"), "utf8"))
        .toBe("# Safe snapshot\n");
      expect((await stat(path.join(materialized.sourceDirectory, "src/index.ts"))).mode & 0o777).toBe(0o444);
      expect((await stat(path.join(materialized.sourceDirectory, "src"))).mode & 0o777).toBe(0o555);
      expect((await stat(materialized.sourceDirectory)).mode & 0o777).toBe(0o555);
      await expect(stat(path.join(materialized.sourceDirectory, ".scopeforge/snapshot-manifest-v1.json")))
        .rejects.toMatchObject({ code: "ENOENT" });
      expect(materialized.manifest.contentDigest).toBe(bundle.contentDigest);
      expect(materialized.manifest.files.map((file) => file.path)).toEqual(["README.md", "src/index.ts"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects artifact-byte or digest substitution before extraction", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "scopeforge-reader-integrity-"));
    try {
      const artifactPath = path.join(directory, "snapshot.tar.gz");
      const bytes = Buffer.from("not a valid snapshot", "utf8");
      await writeFile(artifactPath, bytes);

      await expect(materializeRepositorySnapshotBundle({
        artifactPath,
        workDirectory: directory,
        expected: {
          canonicalRepositoryUrl: "https://github.com/octocat/Hello-World",
          resolvedCommitSha: "a".repeat(40),
          contentDigest: "b".repeat(64),
          artifactDigest: "c".repeat(64),
          storedArtifactBytes: bytes.length,
          retainedFileCount: 0,
          retainedBytes: 0,
        },
        signal: new AbortController().signal,
      })).rejects.toThrow(/artifact digest/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});