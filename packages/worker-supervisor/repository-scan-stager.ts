import { lstat, rm } from "node:fs/promises";
import path from "node:path";
import {
  materializeRepositorySnapshotBundle,
  removeMaterializedRepositorySnapshot,
  type MaterializedRepositorySnapshot,
  type RepositorySnapshotReadExpectation,
} from "@/packages/repository-snapshot";
import {
  downloadRepositoryScanArtifact,
  type RepositoryScanDownloadDescriptor,
} from "./repository-scan-download";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

export { downloadRepositoryScanArtifact } from "./repository-scan-download";

export interface RepositoryScanStagingArtifact {
  snapshotId: string;
  storedArtifactBytes: number;
  artifactDigest: string;
  download: RepositoryScanDownloadDescriptor;
}

export interface RepositoryScanSnapshotIdentity extends RepositorySnapshotReadExpectation {
  snapshotId: string;
}

export interface RepositoryScanStagingInput {
  workDirectory: string;
  artifact: RepositoryScanStagingArtifact;
  snapshot: RepositoryScanSnapshotIdentity;
  expectedHost: string;
  signal: AbortSignal;
}

export interface StagedRepositoryScanSnapshot extends MaterializedRepositorySnapshot {
  snapshotId: string;
}

export interface RepositoryScanStagerDependencies {
  fetch?: typeof fetch;
  materialize?: typeof materializeRepositorySnapshotBundle;
}

function validateIdentity(input: RepositoryScanStagingInput): void {
  if (!path.isAbsolute(input.workDirectory) || /[\r\n\u0000]/.test(input.workDirectory)) {
    throw new Error("Repository scan staging directory must be a safe absolute path.");
  }
  if (!UUID_PATTERN.test(input.snapshot.snapshotId)
      || input.artifact.snapshotId !== input.snapshot.snapshotId) {
    throw new Error("Repository scan staging snapshot identity is invalid.");
  }
  if (!COMMIT_PATTERN.test(input.snapshot.resolvedCommitSha)
      || !SHA256_PATTERN.test(input.snapshot.contentDigest)
      || !SHA256_PATTERN.test(input.snapshot.artifactDigest)
      || input.artifact.artifactDigest !== input.snapshot.artifactDigest
      || input.artifact.storedArtifactBytes !== input.snapshot.storedArtifactBytes) {
    throw new Error("Repository scan staging provenance is inconsistent.");
  }
}

export async function stageRepositoryScanSnapshot(
  input: RepositoryScanStagingInput,
  dependencies: RepositoryScanStagerDependencies = {},
): Promise<StagedRepositoryScanSnapshot> {
  if (input.signal.aborted) {
    throw new DOMException("Repository scan staging was aborted.", "AbortError");
  }
  validateIdentity(input);
  const workMetadata = await lstat(input.workDirectory);
  if (!workMetadata.isDirectory()) {
    throw new Error("Repository scan staging directory is not a directory.");
  }

  const artifactPath = path.join(input.workDirectory, "snapshot.tar.gz");
  const materialize = dependencies.materialize ?? materializeRepositorySnapshotBundle;

  try {
    await downloadRepositoryScanArtifact({
      descriptor: input.artifact.download,
      expectedHost: input.expectedHost,
      expectedBytes: input.snapshot.storedArtifactBytes,
      expectedDigest: input.snapshot.artifactDigest,
      destinationPath: artifactPath,
      signal: input.signal,
    }, {
      ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
    });

    const materialized = await materialize({
      artifactPath,
      workDirectory: input.workDirectory,
      expected: {
        canonicalRepositoryUrl: input.snapshot.canonicalRepositoryUrl,
        resolvedCommitSha: input.snapshot.resolvedCommitSha,
        contentDigest: input.snapshot.contentDigest,
        artifactDigest: input.snapshot.artifactDigest,
        storedArtifactBytes: input.snapshot.storedArtifactBytes,
        retainedFileCount: input.snapshot.retainedFileCount,
        retainedBytes: input.snapshot.retainedBytes,
      },
      signal: input.signal,
    });

    await rm(artifactPath, { force: true });
    return Object.freeze({
      snapshotId: input.snapshot.snapshotId,
      sourceDirectory: materialized.sourceDirectory,
      manifest: materialized.manifest,
    });
  } catch (error) {
    await rm(artifactPath, { force: true }).catch(() => undefined);
    await removeMaterializedRepositorySnapshot(
      path.join(input.workDirectory, "materialized-source"),
    ).catch(() => undefined);
    throw error;
  }
}
