import type { AssetKind, Json } from "@/lib/database.types";
import type { ActiveValidationBudget, CorsPolicyObservation } from "@/packages/runtime-validator";

export interface EnqueueActiveValidationJobInput {
  workspaceId: string;
  assetId: string;
  requestedBy: string;
  canonicalTarget: string;
  assetKind: Extract<AssetKind, "web_application" | "api">;
  verifiedAt: string;
  profileId: "cors-origin-policy";
  profileVersion: 1;
  authorizationGrantedAt: string;
  budget: ActiveValidationBudget;
}

export interface ActiveValidationJobCompletionCounts {
  requestCount: 0 | 1;
  findingCount: number;
}

export interface CorsPolicyObservationPayloadRow {
  sequence: 0;
  kind: "cors-policy";
  payload: Json;
  observation: CorsPolicyObservation;
}
