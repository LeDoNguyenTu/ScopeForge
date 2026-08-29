import type { RepositorySnapshotObjectStore } from "@/lib/repository-snapshots/object-store";
import type { RepositoryScanArtifactRepository } from "./repository";
import {
  RepositoryScanError,
  type RepositoryScanArtifactAccess,
  type RepositoryScanLeaseIdentity,
} from "./types";

const MAX_DOWNLOAD_AUTHORIZATION_MS = 120_000;
const MIN_DOWNLOAD_AUTHORIZATION_MS = 1_000;
const LEASE_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export interface RepositoryScanArtifactAccessDependencies {
  repository: RepositoryScanArtifactRepository;
  objectStore: RepositorySnapshotObjectStore;
  now?: () => Date;
}

function currentTime(dependencies: RepositoryScanArtifactAccessDependencies): Date {
  const now = (dependencies.now ?? (() => new Date()))();
  if (!Number.isFinite(now.getTime())) {
    throw new RepositoryScanError("REPOSITORY_SCAN_ARTIFACT_AUTHORIZATION_FAILED");
  }
  return now;
}

function boundedExpiry(
  now: Date,
  leaseExpiresAt: string,
  artifactExpiresAt: string,
): Date {
  const leaseExpiry = new Date(leaseExpiresAt).getTime();
  const artifactExpiry = new Date(artifactExpiresAt).getTime();
  if (!Number.isFinite(leaseExpiry) || !Number.isFinite(artifactExpiry)) {
    throw new RepositoryScanError("REPOSITORY_SCAN_ARTIFACT_AUTHORIZATION_FAILED");
  }
  const expiresAt = Math.min(
    now.getTime() + MAX_DOWNLOAD_AUTHORIZATION_MS,
    leaseExpiry,
    artifactExpiry,
  );
  if (expiresAt - now.getTime() < MIN_DOWNLOAD_AUTHORIZATION_MS) {
    throw new RepositoryScanError("REPOSITORY_SCAN_ARTIFACT_AUTHORIZATION_FAILED");
  }
  return new Date(expiresAt);
}

function validateDescriptor(
  value: Awaited<ReturnType<RepositorySnapshotObjectStore["createAttemptDownload"]>>,
  now: Date,
  requestedExpiry: Date,
): void {
  if (value.method !== "GET") {
    throw new RepositoryScanError("REPOSITORY_SCAN_ARTIFACT_AUTHORIZATION_FAILED");
  }
  let url: URL;
  try {
    url = new URL(value.url);
  } catch {
    throw new RepositoryScanError("REPOSITORY_SCAN_ARTIFACT_AUTHORIZATION_FAILED");
  }
  const descriptorExpiry = new Date(value.expiresAt).getTime();
  if (
    url.protocol !== "https:"
    || !Number.isFinite(descriptorExpiry)
    || descriptorExpiry <= now.getTime()
    || descriptorExpiry > requestedExpiry.getTime()
    || descriptorExpiry - now.getTime() > MAX_DOWNLOAD_AUTHORIZATION_MS
  ) {
    throw new RepositoryScanError("REPOSITORY_SCAN_ARTIFACT_AUTHORIZATION_FAILED");
  }
}

export async function createRepositoryScanArtifactAccess(
  input: RepositoryScanLeaseIdentity,
  dependencies: RepositoryScanArtifactAccessDependencies,
): Promise<RepositoryScanArtifactAccess> {
  if (!LEASE_TOKEN_PATTERN.test(input.leaseToken)) {
    throw new RepositoryScanError("WORKER_LEASE_INVALID");
  }

  const artifact = await dependencies.repository.resolveLeaseBoundArtifact(input);
  const now = currentTime(dependencies);
  const expiresAt = boundedExpiry(now, artifact.leaseExpiresAt, artifact.artifactExpiresAt);
  const download = await dependencies.objectStore.createAttemptDownload({
    objectKey: artifact.objectKey,
    expiresAt,
  });
  validateDescriptor(download, now, expiresAt);

  return Object.freeze({
    snapshotId: artifact.snapshotId,
    storedArtifactBytes: artifact.storedArtifactBytes,
    artifactDigest: artifact.artifactDigest,
    download,
  });
}