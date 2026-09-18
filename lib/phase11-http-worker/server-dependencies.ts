import { createAdminClient } from "@/lib/supabase/admin";
import type { Phase11cWorkerDatabase } from "@/lib/database.phase11c.types";
import { createPhase11HttpWorkerPreparationContextRepository } from "./preparation-context";

export function createPhase11HttpWorkerPreparationServerDependencies() {
  const admin = createAdminClient<Phase11cWorkerDatabase>();
  return Object.freeze({
    contextRepository: createPhase11HttpWorkerPreparationContextRepository(admin),
  });
}
