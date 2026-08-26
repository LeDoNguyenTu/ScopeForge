import { createHash } from "node:crypto";
import {
  REPOSITORY_SNAPSHOT_FORMAT,
  type RepositorySnapshotManifest,
  type RepositorySnapshotManifestFile,
  type RepositorySnapshotSkipCounts,
  type RepositorySnapshotSourceIdentity,
  type ScratchRepositoryFile,
} from "./types";

export interface BuiltRepositorySnapshotManifest {
  bytes: Buffer;
  contentDigest: string;
  manifest: RepositorySnapshotManifest;
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) {
      throw new Error("Repository snapshot manifest contains an invalid numeric value.");
    }
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  throw new Error("Repository snapshot manifest contains an unsupported value.");
}

function validateSource(source: RepositorySnapshotSourceIdentity): void {
  if (!/^https:\/\/github[.]com\/[^/?#]+\/[^/?#]+$/.test(source.canonicalRepositoryUrl)
      || source.canonicalRepositoryUrl.length > 512) {
    throw new Error("Repository snapshot canonical repository URL is invalid.");
  }
  if (Buffer.byteLength(source.defaultBranch, "utf8") < 1
      || Buffer.byteLength(source.defaultBranch, "utf8") > 255) {
    throw new Error("Repository snapshot default branch is invalid.");
  }
  if (!/^[a-f0-9]{40}$/.test(source.resolvedCommitSha)) {
    throw new Error("Repository snapshot commit SHA is invalid.");
  }
}

function validateSkipCounts(skipCounts: RepositorySnapshotSkipCounts): void {
  for (const value of Object.values(skipCounts)) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 50_000) {
      throw new Error("Repository snapshot skip count is invalid.");
    }
  }
}

function manifestFiles(files: readonly ScratchRepositoryFile[]): readonly RepositorySnapshotManifestFile[] {
  const records = files.map((file) => {
    if (!Number.isSafeInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error("Repository snapshot file provenance is invalid.");
    }
    return Object.freeze({ path: file.path, size: file.size, sha256: file.sha256 });
  });
  records.sort((a, b) => Buffer.compare(Buffer.from(a.path, "utf8"), Buffer.from(b.path, "utf8")));
  return Object.freeze(records);
}

export function buildRepositorySnapshotManifest(input: {
  files: readonly ScratchRepositoryFile[];
  source: RepositorySnapshotSourceIdentity;
  skipCounts: RepositorySnapshotSkipCounts;
}): BuiltRepositorySnapshotManifest {
  validateSource(input.source);
  validateSkipCounts(input.skipCounts);
  const files = manifestFiles(input.files);
  const stable = {
    schemaVersion: 1 as const,
    format: REPOSITORY_SNAPSHOT_FORMAT,
    canonicalRepositoryUrl: input.source.canonicalRepositoryUrl,
    defaultBranch: input.source.defaultBranch,
    resolvedCommitSha: input.source.resolvedCommitSha,
    files,
    skipCounts: Object.freeze({ ...input.skipCounts }),
  };
  const preDigestBytes = Buffer.from(canonicalJson(stable), "utf8");
  const contentDigest = createHash("sha256").update(preDigestBytes).digest("hex");
  const manifest: RepositorySnapshotManifest = Object.freeze({
    ...stable,
    contentDigest,
  });
  return Object.freeze({
    bytes: Buffer.from(canonicalJson(manifest), "utf8"),
    contentDigest,
    manifest,
  });
}
