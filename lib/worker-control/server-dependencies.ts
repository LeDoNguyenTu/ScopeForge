import type { Phase10a2Database } from "@/lib/database.phase10a2.types";
import { createRepositorySnapshotObjectStore } from "@/lib/repository-snapshots/server-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWorkerControlRepository } from "./repository";
import type { WorkerControlServiceDependencies } from "./service";

export function createWorkerControlServerDependencies(): WorkerControlServiceDependencies {
  const admin = createAdminClient<Phase10a2Database>();
  const repository = createWorkerControlRepository(admin);
  let repositorySnapshotObjectStore: ReturnType<typeof createRepositorySnapshotObjectStore> | undefined;
  return Object.freeze({
    repository,
    runtimeRepository: repository,
    repositorySnapshotObjectStore: () => {
      repositorySnapshotObjectStore ??= createRepositorySnapshotObjectStore();
      return repositorySnapshotObjectStore;
    },
  });
}
