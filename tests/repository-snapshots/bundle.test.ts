import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { writeRepositorySnapshotBundle } from "@/packages/repository-snapshot/bundle";
import type {
  RepositorySnapshotSkipCounts,
  ScratchRepositoryFile,
} from "@/packages/repository-snapshot/types";

const sha = "a".repeat(40);
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

async function makeFiles(directory: string, order: readonly string[]): Promise<ScratchRepositoryFile[]> {
  const result: ScratchRepositoryFile[] = [];
  for (const name of order) {
    const bytes = Buffer.from(`content:${name}`, "utf8");
    const scratchPath = path.join(directory, `${name.replaceAll("/", "-")}.blob`);
    await writeFile(scratchPath, bytes);
    result.push({ path: name, scratchPath, size: bytes.length, sha256: digest(bytes) });
  }
  return result;
}

async function build(order: readonly string[]) {
  const directory = await mkdtemp(path.join(tmpdir(), "scopeforge-bundle-"));
  try {
    const files = await makeFiles(directory, order);
    const bundle = await writeRepositorySnapshotBundle({
      files,
      source: {
        canonicalRepositoryUrl: "https://github.com/octocat/Hello-World",
        defaultBranch: "master",
        resolvedCommitSha: sha,
      },
      skipCounts: zeroSkips,
      workDirectory: directory,
      signal: new AbortController().signal,
    });
    return {
      bytes: await readFile(bundle.artifactPath),
      bundle,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("Phase 6B deterministic repository snapshot bundle", () => {
  it("is byte-identical regardless of source archive file order", async () => {
    const first = await build(["z.txt", "src/a.ts"]);
    const second = await build(["src/a.ts", "z.txt"]);

    expect(first.bytes.equals(second.bytes)).toBe(true);
    expect(first.bundle.contentDigest).toBe(second.bundle.contentDigest);
    expect(first.bundle.artifactDigest).toBe(second.bundle.artifactDigest);
    expect(first.bundle.storedArtifactBytes).toBe(first.bytes.length);
  });

  it("uses a fixed gzip header and normalized non-executable tar metadata", async () => {
    const { bytes } = await build(["a.txt"]);
    expect([...bytes.subarray(0, 10)]).toEqual([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x03]);

    const tar = gunzipSync(bytes);
    expect(tar.subarray(0, 100).toString("utf8").replace(/\0+$/, "")).toBe("a.txt");
    expect(parseInt(tar.subarray(100, 108).toString("ascii").replace(/\0.*$/, ""), 8)).toBe(0o644);
    expect(parseInt(tar.subarray(108, 116).toString("ascii").replace(/\0.*$/, ""), 8)).toBe(0);
    expect(parseInt(tar.subarray(116, 124).toString("ascii").replace(/\0.*$/, ""), 8)).toBe(0);
    expect(parseInt(tar.subarray(136, 148).toString("ascii").replace(/\0.*$/, ""), 8)).toBe(0);
  });

  it("embeds exactly one generated manifest with contentDigest but never artifactDigest", async () => {
    const { bytes, bundle } = await build(["a.txt"]);
    const tarText = gunzipSync(bytes).toString("utf8");
    expect(tarText.match(/\.scopeforge\/snapshot-manifest-v1\.json/g)).toHaveLength(1);
    expect(tarText).toContain(`\"contentDigest\":\"${bundle.contentDigest}\"`);
    expect(tarText).not.toContain("artifactDigest");
  });
});
