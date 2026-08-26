import { buildRepositorySnapshotManifest } from "./manifest";
import { writeDeterministicRepositoryTarGzip } from "./tar-writer";
import type {
  RepositorySnapshotBundle,
  RepositorySnapshotSkipCounts,
  RepositorySnapshotSourceIdentity,
  ScratchRepositoryFile,
} from "./types";

export async function writeRepositorySnapshotBundle(input: {
  files: readonly ScratchRepositoryFile[];
  source: RepositorySnapshotSourceIdentity;
  skipCounts: RepositorySnapshotSkipCounts;
  workDirectory: string;
  signal: AbortSignal;
}): Promise<RepositorySnapshotBundle> {
  if (input.signal.aborted) throw new DOMException("Repository snapshot building was aborted.", "AbortError");
  const manifest = buildRepositorySnapshotManifest({
    files: input.files,
    source: input.source,
    skipCounts: input.skipCounts,
  });
  const artifact = await writeDeterministicRepositoryTarGzip({
    files: input.files,
    manifestBytes: manifest.bytes,
    workDirectory: input.workDirectory,
    signal: input.signal,
  });
  const retainedBytes = input.files.reduce((sum, file) => sum + file.size, 0);

  return Object.freeze({
    artifactPath: artifact.artifactPath,
    contentDigest: manifest.contentDigest,
    artifactDigest: artifact.artifactDigest,
    retainedFileCount: input.files.length,
    retainedBytes,
    storedArtifactBytes: artifact.storedArtifactBytes,
    skipCounts: Object.freeze({ ...input.skipCounts }),
  });
}
