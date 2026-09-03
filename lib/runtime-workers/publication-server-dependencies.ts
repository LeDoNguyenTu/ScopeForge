import type { Phase6dDatabase } from "@/lib/database.phase6d.types";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createRuntimeObservationRepository,
  normalizeRuntimeObservationPayloads,
} from "@/lib/runtime-observations/repository";
import {
  createActiveValidationRepository,
  normalizeCorsPolicyObservationPayload,
} from "@/lib/active-validation/repository";
import { prepareFindingIngestionBatch } from "@/lib/security-findings/ingestion";
import { createRuntimeWorkerFinalizationRepository } from "./finalization-context";
import type { RuntimeWorkerPublicationDependencies } from "./publication";

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function createRuntimeWorkerPublicationServerDependencies(): RuntimeWorkerPublicationDependencies {
  const admin = createAdminClient();
  const controlAdmin = createAdminClient<Phase6dDatabase>();
  const passive = createRuntimeObservationRepository(admin);
  const active = createActiveValidationRepository(admin);
  const finalization = createRuntimeWorkerFinalizationRepository(controlAdmin);

  const dependencies: RuntimeWorkerPublicationDependencies = {
    getContext: finalization.getContext,
    loadPassiveJob: passive.load,
    loadActiveJob: active.load,
    publishPassiveSuccess: async ({ publication, finalization: terminal }) => {
      const observationRows = normalizeRuntimeObservationPayloads(
        publication.observations,
        publication.maximumBytes,
      );
      const prepared = prepareFindingIngestionBatch({
        workspaceId: publication.job.workspace_id,
        assetId: publication.job.asset_id,
        scanJobId: publication.job.id,
        observedAt: publication.observedAt,
        findings: publication.findings,
        evidence: publication.evidence,
      });
      return finalization.publishPassiveSuccess({
        finalization: terminal,
        observationRows: toJson(observationRows),
        findingRows: prepared.findings,
        evidenceRows: prepared.evidence,
        observedAt: prepared.observedAt,
      });
    },
    publishActiveSuccess: async ({ publication, finalization: terminal }) => {
      const observationRow = normalizeCorsPolicyObservationPayload(
        publication.observation,
        publication.maximumBytes,
      );
      const prepared = prepareFindingIngestionBatch({
        workspaceId: publication.job.workspace_id,
        assetId: publication.job.asset_id,
        scanJobId: publication.job.id,
        observedAt: publication.observedAt,
        findings: publication.findings,
        evidence: publication.evidence,
      });
      return finalization.publishActiveSuccess({
        finalization: terminal,
        observationRow: toJson(observationRow),
        findingRows: prepared.findings,
        evidenceRows: prepared.evidence,
        observedAt: prepared.observedAt,
      });
    },
    finalize: finalization.finalize,
  };

  return Object.freeze(dependencies);
}
