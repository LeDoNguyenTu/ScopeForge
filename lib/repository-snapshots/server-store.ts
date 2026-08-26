import { createR2RepositorySnapshotObjectStore } from "./r2-object-store";
import { loadRepositorySnapshotStorageConfig } from "./storage-config";

export function createRepositorySnapshotObjectStore() {
  return createR2RepositorySnapshotObjectStore({
    config: loadRepositorySnapshotStorageConfig(),
  });
}
