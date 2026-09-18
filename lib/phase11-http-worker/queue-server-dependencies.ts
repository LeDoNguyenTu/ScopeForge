import { createAdminClient } from "@/lib/supabase/admin";
import type { Phase11cWorkerDatabase } from "@/lib/database.phase11c.types";
import { createPhase11HttpWorkerQueueAdapter } from "./queue";
import { createPhase11HttpWorkerQueueRepository } from "./queue-repository";

export function createPhase11HttpWorkerQueueServerDependencies() {
  const repository = createPhase11HttpWorkerQueueRepository(
    createAdminClient<Phase11cWorkerDatabase>(),
  );
  return createPhase11HttpWorkerQueueAdapter(repository);
}
