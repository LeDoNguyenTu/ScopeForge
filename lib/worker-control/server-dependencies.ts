import type { Phase6dDatabase } from "@/lib/database.phase6d.types";
import { createRepositorySnapshotObjectStore } from "@/lib/repository-snapshots/server-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWorkerControlRepository } from "./repository";
import type { WorkerControlServiceDependencies } from "./service";

export function createWorkerControlServerDependencies(): WorkerControlServiceDependencies {
  const admin = createAdminClient<Phase6dDatabase>();
  let repositorySnapshotObjectStore: ReturnType<typeof createRepositorySnapshotObjectStore> | undefined;
  return Object.freeze({
    repository: createWorkerControlRepository(admin),
    repositorySnapshotObjectStore: () => {
      repositorySnapshotObjectStore ??= createRepositorySnapshotObjectStore();
      return repositorySnapshotObjectStore;
    },
  });
}
