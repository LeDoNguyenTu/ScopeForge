import type { Phase6dDatabase } from "@/lib/database.phase6d.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRuntimeObservationRepository } from "@/lib/runtime-observations/repository";
import { createActiveValidationRepository } from "@/lib/active-validation/repository";
import { createRuntimeWorkerFinalizationRepository } from "./finalization-context";
import type { RuntimeWorkerPublicationDependencies } from "./publication";

export function createRuntimeWorkerPublicationServerDependencies(): RuntimeWorkerPublicationDependencies {
  const admin = createAdminClient();
  const controlAdmin = createAdminClient<Phase6dDatabase>();
  const passive = createRuntimeObservationRepository(admin);
  const active = createActiveValidationRepository(admin);
  const finalization = createRuntimeWorkerFinalizationRepository(controlAdmin);

  return Object.freeze({
    getContext: finalization.getContext,
    loadPassiveJob: passive.load,
    loadActiveJob: active.load,
    persistPassive: async (input) => {
      await passive.persistResult(
        input.job,
        input.observations,
        input.findings,
        input.evidence,
        input.maximumBytes,
        input.observedAt,
      );
    },
    persistActive: async (input) => {
      await active.persistResult(
        input.job,
        input.observation,
        input.findings,
        input.evidence,
        input.maximumBytes,
        input.observedAt,
      );
    },
    finalize: finalization.finalize,
  });
}
