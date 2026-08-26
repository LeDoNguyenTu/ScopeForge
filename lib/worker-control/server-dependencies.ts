import { createRepositorySnapshotObjectStore } from "@/lib/repository-snapshots/server-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWorkerControlRepository } from "./repository";
import type { WorkerControlServiceDependencies } from "./service";

export function createWorkerControlServerDependencies(): WorkerControlServiceDependencies {
  const admin = createAdminClient();
  let repositorySnapshotObjectStore: ReturnType<typeof createRepositorySnapshotObjectStore> | undefined;
  return Object.freeze({
    repository: createWorkerControlRepository(admin),
    repositorySnapshotObjectStore: () => {
      repositorySnapshotObjectStore ??= createRepositorySnapshotObjectStore();
      return repositorySnapshotObjectStore;
    },
  });
}
