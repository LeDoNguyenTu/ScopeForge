import { createAdminClient } from "@/lib/supabase/admin";
import type { Phase11cFinalizationDatabase } from "@/lib/database.phase11c-finalization.types";
import type { Phase11RpcClient } from "@/lib/database.phase11.types";
import { advancePentestRun } from "@/lib/pentest-runs/advance-run";
import { createPentestRunRepository } from "@/lib/pentest-runs/repository";
import { createPhase11HttpWorkerFinalizationRepository } from "./finalization-context";
import { createPhase11HttpWorkerQueueServerDependencies } from "./queue-server-dependencies";
import { PHASE11_HTTP_CAPABILITIES } from "./capabilities";

export function createPhase11HttpWorkerFinalizationServerDependencies() {
  const admin = createAdminClient<Phase11cFinalizationDatabase>();
  const repository = createPhase11HttpWorkerFinalizationRepository(
    admin,
  );
  const runRepository = createPentestRunRepository(admin as unknown as Phase11RpcClient);
  const queue = createPhase11HttpWorkerQueueServerDependencies();
  return Object.freeze({
    getContext: repository.getContext,
    finalize: repository.finalize,
    advanceRun: (input: Parameters<typeof advancePentestRun>[0]) => advancePentestRun(input, {
      repository: runRepository,
      capabilities: PHASE11_HTTP_CAPABILITIES,
      enqueueApprovedAction: queue.enqueueApprovedAction,
      cancelQueuedAction: queue.cancelQueuedAction,
    }),
  });
}
