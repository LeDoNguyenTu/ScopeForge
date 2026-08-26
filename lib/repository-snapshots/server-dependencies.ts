import { createAdminClient } from "@/lib/supabase/admin";
import { createR2RepositorySnapshotObjectStore } from "./r2-object-store";
import { createRepositorySnapshotRepository } from "./repository";
import type { RepositorySnapshotServiceDependencies } from "./service";
import { loadRepositorySnapshotStorageConfig } from "./storage-config";

export function createRepositorySnapshotServerDependencies(): RepositorySnapshotServiceDependencies {
  const admin = createAdminClient();
  return Object.freeze({
    repository: createRepositorySnapshotRepository(admin),
    objectStore: createR2RepositorySnapshotObjectStore({
      config: loadRepositorySnapshotStorageConfig(),
    }),
  });
}
