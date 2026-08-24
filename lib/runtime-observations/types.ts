import type {
  AssetKind,
  Json,
  ScanJobStatus,
} from "@/lib/database.types";
import type {
  RuntimeObservation,
  RuntimeObservationBudget,
} from "@/packages/runtime-observer";

export type RuntimeAssetKind = Extract<AssetKind, "web_application" | "api">;

export interface EnqueueRuntimeObservationJobInput {
  workspaceId: string;
  assetId: string;
  requestedBy: string;
  canonicalTarget: string;
  assetKind: RuntimeAssetKind;
  verifiedAt: string;
  budget: RuntimeObservationBudget;
}

export interface RuntimeObservationPayloadRow {
  sequence: number;
  kind: RuntimeObservation["kind"];
  payload: Json;
}

export interface RuntimeJobCompletionCounts {
  requestCount: number;
  redirectCount: number;
  findingCount: number;
}

export type RuntimeTerminalStatus = Extract<
  ScanJobStatus,
  "succeeded" | "failed" | "blocked" | "cancelled"
>;
