export const REPOSITORY_SNAPSHOT_FORMAT = "scopeforge-repository-snapshot-v1" as const;
export const REPOSITORY_SNAPSHOT_MANIFEST_PATH = ".scopeforge/snapshot-manifest-v1.json" as const;

export const REPOSITORY_SNAPSHOT_LIMITS = Object.freeze({
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

export interface RepositorySnapshotSkipCounts {
  symlink: number;
  hardlink: number;
  fileTooLarge: number;
  retainedFileLimit: number;
  retainedBytesLimit: number;
}

export interface ScratchRepositoryFile {
  path: string;
  scratchPath: string;
  size: number;
  sha256: string;
}

export interface ParsedRepositoryArchive {
  files: readonly ScratchRepositoryFile[];
  compressedBytes: number;
  expandedBytes: number;
  skipCounts: RepositorySnapshotSkipCounts;
}

export interface RepositorySnapshotSourceIdentity {
  canonicalRepositoryUrl: string;
  defaultBranch: string;
  resolvedCommitSha: string;
}

export interface RepositorySnapshotManifestFile {
  path: string;
  size: number;
  sha256: string;
}

export interface RepositorySnapshotManifest {
  schemaVersion: 1;
  format: typeof REPOSITORY_SNAPSHOT_FORMAT;
  canonicalRepositoryUrl: string;
  defaultBranch: string;
  resolvedCommitSha: string;
  files: readonly RepositorySnapshotManifestFile[];
  skipCounts: RepositorySnapshotSkipCounts;
  contentDigest: string;
}

export interface RepositorySnapshotBundle {
  artifactPath: string;
  contentDigest: string;
  artifactDigest: string;
  retainedFileCount: number;
  retainedBytes: number;
  storedArtifactBytes: number;
  skipCounts: RepositorySnapshotSkipCounts;
}
