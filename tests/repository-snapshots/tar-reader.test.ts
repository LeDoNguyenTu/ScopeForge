import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { parseGitHubRepositoryArchive } from "@/packages/repository-snapshot/tar-reader";
import { createTestTarGzip, paxRecord } from "./tar-fixtures";

const sha = "a".repeat(40);

async function withScratch<T>(run: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(path.join(tmpdir(), "scopeforge-tar-reader-"));
  try {
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("Phase 6B hostile GitHub tar reader", () => {
  it("accepts one GitHub global PAX commit header, strips one wrapper, and sorts retained files", async () => {
    await withScratch(async (workDirectory) => {
      const archive = createTestTarGzip([
        { name: "pax_global_header", type: "g", body: paxRecord("comment", sha) },
        { name: "octocat-Hello-World-aaaaaaa/", type: "5" },
        { name: "octocat-Hello-World-aaaaaaa/z.txt", body: Buffer.from("z") },
        { name: "octocat-Hello-World-aaaaaaa/a.txt", body: Buffer.from("a") },
        { name: "octocat-Hello-World-aaaaaaa/link", type: "2", linkname: "a.txt" },
        { name: "octocat-Hello-World-aaaaaaa/hard", type: "1", linkname: "a.txt" },
      ]);

      const parsed = await parseGitHubRepositoryArchive({
        archive: Readable.from([archive]),
        expectedCommitSha: sha,
        workDirectory,
        signal: new AbortController().signal,
      });

      expect(parsed.files.map((file) => file.path)).toEqual(["a.txt", "z.txt"]);
      expect(parsed.skipCounts).toMatchObject({ symlink: 1, hardlink: 1 });
      expect(parsed.expandedBytes).toBe(2);
      await expect(readFile(parsed.files[0]!.scratchPath, "utf8")).resolves.toBe("a");
    });
  });

  it("accepts reviewed local PAX path metadata without letting it change authority", async () => {
    await withScratch(async (workDirectory) => {
      const longPath = `root/${"x".repeat(120)}.txt`;
      const archive = createTestTarGzip([
        { name: "pax_global_header", type: "g", body: paxRecord("comment", sha) },
        { name: "root/", type: "5" },
        { name: "pax-local", type: "x", body: paxRecord("path", longPath) },
        { name: "root/placeholder", body: Buffer.from("ok") },
      ]);
      const parsed = await parseGitHubRepositoryArchive({
        archive: Readable.from([archive]),
        expectedCommitSha: sha,
        workDirectory,
        signal: new AbortController().signal,
      });
      expect(parsed.files[0]?.path).toBe(`${"x".repeat(120)}.txt`);
    });
  });

  it("rejects wrong global PAX commit identity, multiple wrappers, duplicates, and special entries", async () => {
    const cases = [
      [
        { name: "pax_global_header", type: "g" as const, body: paxRecord("comment", "b".repeat(40)) },
        { name: "root/", type: "5" as const },
      ],
      [
        { name: "root/", type: "5" as const },
        { name: "root/a", body: Buffer.from("a") },
        { name: "other/b", body: Buffer.from("b") },
      ],
      [
        { name: "root/", type: "5" as const },
        { name: "root/a", body: Buffer.from("a") },
        { name: "root/a", body: Buffer.from("b") },
      ],
      [
        { name: "root/", type: "5" as const },
        { name: "root/device", type: "3" as const },
      ],
    ];

    for (const entries of cases) {
      await withScratch(async (workDirectory) => {
        await expect(parseGitHubRepositoryArchive({
          archive: Readable.from([createTestTarGzip(entries)]),
          expectedCommitSha: sha,
          workDirectory,
          signal: new AbortController().signal,
        })).rejects.toThrow();
      });
    }
  });

  it("rejects malformed tar checksums and reserved manifest conflicts", async () => {
    for (const entries of [
      [
        { name: "root/", type: "5" as const },
        { name: "root/a", body: Buffer.from("a"), corruptChecksum: true },
      ],
      [
        { name: "root/", type: "5" as const },
        { name: "root/.scopeforge/snapshot-manifest-v1.json", body: Buffer.from("evil") },
      ],
    ]) {
      await withScratch(async (workDirectory) => {
        await expect(parseGitHubRepositoryArchive({
          archive: Readable.from([createTestTarGzip(entries)]),
          expectedCommitSha: sha,
          workDirectory,
          signal: new AbortController().signal,
        })).rejects.toThrow();
      });
    }
  });
});
