import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import {
  Phase3ImportWorkflowError,
  type Phase3ImportAsset,
  type Phase3ImportRepositoryContract,
  type Phase3ImportResult,
  type PersistPhase3ImportInput,
} from "./service";

type Phase3ImportRpcArgs = {
  target_workspace_id: string;
  target_asset_id: string;
  target_actor_id: string;
  target_repository_canonical_url: string;
  target_run_ref: string;
  target_tool_version: string;
  target_scan_started_at: string;
  target_scan_duration_ms: number;
  target_scanner_descriptors: Json;
  target_scanner_error_count: number;
  target_files_analyzed: number;
  target_files_skipped: number;
  target_total_bytes: number;
  finding_rows: Json;
  evidence_rows: Json;
};

type Phase3ImportRpcClient = {
  rpc(
    name: "persist_phase3_import_result",
    args: Phase3ImportRpcArgs,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function isResult(value: unknown): value is Phase3ImportResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<Phase3ImportResult>;
  return typeof candidate.importRunId === "string"
    && candidate.importRunId.length > 0
    && typeof candidate.scanJobId === "string"
    && candidate.scanJobId.length > 0
    && typeof candidate.replayed === "boolean";
}

function mapPersistenceError(message: string): Phase3ImportWorkflowError {
  if (message.includes("PHASE3_IMPORT_RUN_REF_CONFLICT")) {
    return new Phase3ImportWorkflowError("PHASE3_IMPORT_RUN_REF_CONFLICT");
  }
  if (message.includes("PHASE3_IMPORT_ACCESS_DENIED")) {
    return new Phase3ImportWorkflowError("PHASE3_IMPORT_FORBIDDEN");
  }
  if (message.includes("PHASE3_IMPORT_ASSET_MISMATCH")) {
    return new Phase3ImportWorkflowError("PHASE3_IMPORT_ASSET_MISMATCH");
  }
  if (message.includes("PHASE3_IMPORT_PAYLOAD_INVALID")) {
    return new Phase3ImportWorkflowError("PHASE3_IMPORT_PAYLOAD_INVALID");
  }
  if (message.includes("PHASE3_IMPORT_EVIDENCE_ID_CONFLICT")) {
    return new Phase3ImportWorkflowError("PHASE3_IMPORT_EVIDENCE_ID_CONFLICT");
  }
  if (message.includes("PHASE3_IMPORT_FINDING_ID_CONFLICT")) {
    return new Phase3ImportWorkflowError("PHASE3_IMPORT_FINDING_ID_CONFLICT");
  }
  return new Phase3ImportWorkflowError("PHASE3_IMPORT_PERSISTENCE_FAILED");
}

export function createPhase3ImportRepository(
  client: SupabaseClient<Database>,
): Phase3ImportRepositoryContract {
  async function loadAsset(workspaceId: string, assetId: string): Promise<Phase3ImportAsset | null> {
    const { data, error } = await client
      .from("assets")
      .select("id,workspace_id,kind,canonical_target")
      .eq("workspace_id", workspaceId)
      .eq("id", assetId)
      .maybeSingle();

    if (error) {
      throw new Phase3ImportWorkflowError("PHASE3_IMPORT_ASSET_NOT_AVAILABLE");
    }
    if (!data) return null;

    return {
      id: data.id,
      workspace_id: data.workspace_id,
      kind: data.kind,
      canonical_target: data.canonical_target,
    };
  }

  async function persist(input: PersistPhase3ImportInput): Promise<Phase3ImportResult> {
    const rpcClient = client as unknown as Phase3ImportRpcClient;
    const { data, error } = await rpcClient.rpc("persist_phase3_import_result", {
      target_workspace_id: input.workspaceId,
      target_asset_id: input.assetId,
      target_actor_id: input.actorId,
      target_repository_canonical_url: input.repositoryCanonicalUrl,
      target_run_ref: input.runRef,
      target_tool_version: input.toolVersion,
      target_scan_started_at: input.scanStartedAt,
      target_scan_duration_ms: input.scanDurationMs,
      target_scanner_descriptors: toJson(input.scannerDescriptors),
      target_scanner_error_count: input.scannerErrorCount,
      target_files_analyzed: input.filesAnalyzed,
      target_files_skipped: input.filesSkipped,
      target_total_bytes: input.totalBytes,
      finding_rows: toJson(input.findings),
      evidence_rows: toJson(input.evidence),
    });

    if (error) throw mapPersistenceError(error.message);
    if (!isResult(data)) {
      throw new Phase3ImportWorkflowError("PHASE3_IMPORT_PERSISTENCE_FAILED");
    }
    return data;
  }

  return Object.freeze({ loadAsset, persist });
}
