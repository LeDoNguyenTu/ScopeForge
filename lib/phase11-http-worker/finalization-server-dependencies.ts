import { createAdminClient } from "@/lib/supabase/admin";
import type { Phase11cFinalizationDatabase } from "@/lib/database.phase11c-finalization.types";
import { createPhase11HttpWorkerFinalizationRepository } from "./finalization-context";

export function createPhase11HttpWorkerFinalizationServerDependencies() {
  const repository = createPhase11HttpWorkerFinalizationRepository(
    createAdminClient<Phase11cFinalizationDatabase>(),
  );
  return Object.freeze({
    getContext: repository.getContext,
    finalize: repository.finalize,
  });
}
