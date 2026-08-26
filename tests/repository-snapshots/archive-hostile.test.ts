import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  REPOSITORY_SNAPSHOT_LIMITS,
  parseGitHubRepositoryArchive,
} from "@/packages/repository-snapshot";
import { createTestTarGzip, paxRecord } from "./tar-fixtures";

const sha = "a".repeat(40);

async function scratch<T>(run: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(path.join(tmpdir(), "scopeforge-hostile-"));
  try {
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("Phase 6B hostile archive budgets", () => {
  it("pins the reviewed parser and artifact limits", () => {
    expect(REPOSITORY_SNAPSHOT_LIMITS).toEqual({
      maxCompressedBytes: 134_217_728,
      maxExpandedRegularBytes: 536_870_912,
      maxTarStreamBytes: 570_425_344,
      maxEntries: 50_000,
      maxRetainedFiles: 20_000,
      maxRetainedFileBytes: 2_097_152,
      maxRetainedBytes: 268_435_456,
      maxPathBytes: 1_024,
      maxArtifactBytes: 335_544_320,
      maxPaxBytes: 65_536,
    });
  });

  it("skips oversized regular files while continuing safe parsing", async () => {
    await scratch(async (workDirectory) => {
      const archive = createTestTarGzip([
        { name: "root/", type: "5" },
        { name: "root/large.bin", body: Buffer.alloc(REPOSITORY_SNAPSHOT_LIMITS.maxRetainedFileBytes + 1, 1) },
        { name: "root/small.txt", body: Buffer.from("ok") },
      ]);
      const parsed = await parseGitHubRepositoryArchive({
        archive: Readable.from([archive]),
        expectedCommitSha: sha,
        workDirectory,
        signal: new AbortController().signal,
      });
      expect(parsed.files.map((file) => file.path)).toEqual(["small.txt"]);
      expect(parsed.skipCounts.fileTooLarge).toBe(1);
      expect(parsed.expandedBytes).toBe(REPOSITORY_SNAPSHOT_LIMITS.maxRetainedFileBytes + 3);
    });
  });

  it("allows only the single expected GitHub global PAX comment", async () => {
    await scratch(async (workDirectory) => {
      const globalBody = Buffer.concat([
        paxRecord("comment", sha),
        paxRecord("path", "attacker-controlled"),
      ]);
      const archive = createTestTarGzip([
        { name: "pax_global_header", type: "g", body: globalBody },
        { name: "root/", type: "5" },
      ]);
      await expect(parseGitHubRepositoryArchive({
        archive: Readable.from([archive]),
        expectedCommitSha: sha,
        workDirectory,
        signal: new AbortController().signal,
      })).rejects.toThrow();
    });
  });

  it("honors cancellation before archive processing", async () => {
    await scratch(async (workDirectory) => {
      const controller = new AbortController();
      controller.abort();
      await expect(parseGitHubRepositoryArchive({
        archive: Readable.from([createTestTarGzip([{ name: "root/", type: "5" }])]),
        expectedCommitSha: sha,
        workDirectory,
        signal: controller.signal,
      })).rejects.toMatchObject({ name: "AbortError" });
    });
  });
});
