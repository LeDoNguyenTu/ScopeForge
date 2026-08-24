import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Json,
  ScanJobStatus,
} from "@/lib/database.types";
import type { RuntimeObservation } from "@/packages/runtime-observer";
import type {
  EnqueueRuntimeObservationJobInput,
  RuntimeJobCompletionCounts,
  RuntimeObservationPayloadRow,
} from "./types";

type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];
type RuntimeObservationRow = Database["public"]["Tables"]["runtime_observations"]["Row"];

const ALLOWED_TRANSITIONS: Readonly<Record<ScanJobStatus, readonly ScanJobStatus[]>> = Object.freeze({
  queued: Object.freeze(["running", "blocked", "cancelled"]),
  running: Object.freeze(["succeeded", "failed", "blocked", "cancelled"]),
  succeeded: Object.freeze([]),
  failed: Object.freeze([]),
  blocked: Object.freeze([]),
  cancelled: Object.freeze([]),
});

function safeCode(value: string): string {
  return value.trim().slice(0, 64) || "RUNTIME_OBSERVATION_FAILED";
}

function safeReason(value: string): string {
  return value.trim().slice(0, 500) || "Runtime observation was blocked by policy.";
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function assertRuntimeJobTransition(
  current: ScanJobStatus,
  next: ScanJobStatus,
): void {
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new Error(`Invalid runtime job transition: ${current} -> ${next}`);
  }
}

export function normalizeRuntimeObservationPayloads(
  observations: readonly RuntimeObservation[],
  maximumBytes: number,
): readonly RuntimeObservationPayloadRow[] {
  if (!Number.isInteger(maximumBytes) || maximumBytes <= 0) {
    throw new Error("Observation persistence budget must be a positive integer.");
  }

  const rows = observations.map((observation, sequence) => ({
    sequence,
    kind: observation.kind,
    payload: toJson(observation),
  }));
  const serializedBytes = Buffer.byteLength(JSON.stringify(rows.map((row) => row.payload)), "utf8");
  if (serializedBytes > maximumBytes) {
    throw new Error("Observation persistence budget exceeded.");
  }

  return Object.freeze(rows.map((row) => Object.freeze(row)));
}

export function createRuntimeObservationRepository(admin: SupabaseClient<Database>) {
  async function enqueue(input: EnqueueRuntimeObservationJobInput): Promise<ScanJobRow> {
    const { data, error } = await admin
      .from("scan_jobs")
      .insert({
        workspace_id: input.workspaceId,
        asset_id: input.assetId,
        job_kind: "passive_runtime",
        status: "queued",
        requested_by: input.requestedBy,
        blocked_reason: null,
        authorization_canonical_target: input.canonicalTarget,
        authorization_asset_kind: input.assetKind,
        authorization_verified_at: input.verifiedAt,
        budget: toJson(input.budget),
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async function load(jobId: string): Promise<ScanJobRow | null> {
    const { data, error } = await admin
      .from("scan_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("job_kind", "passive_runtime")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async function loadForWorkspace(jobId: string, workspaceId: string): Promise<ScanJobRow | null> {
    const { data, error } = await admin
      .from("scan_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("workspace_id", workspaceId)
      .eq("job_kind", "passive_runtime")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async function transition(
    job: ScanJobRow,
    next: ScanJobStatus,
    patch: Database["public"]["Tables"]["scan_jobs"]["Update"] = {},
  ): Promise<ScanJobRow> {
    assertRuntimeJobTransition(job.status, next);
    const { data, error } = await admin
      .from("scan_jobs")
      .update({ ...patch, status: next })
      .eq("id", job.id)
      .eq("workspace_id", job.workspace_id)
      .eq("job_kind", "passive_runtime")
      .eq("status", job.status)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Runtime job transition conflict.");
    return data;
  }

  function markRunning(job: ScanJobRow): Promise<ScanJobRow> {
    return transition(job, "running", { started_at: new Date().toISOString() });
  }

  function markBlocked(job: ScanJobRow, code: string, reason: string): Promise<ScanJobRow> {
    return transition(job, "blocked", {
      failure_code: safeCode(code),
      blocked_reason: safeReason(reason),
      finished_at: new Date().toISOString(),
    });
  }

  function markSucceeded(job: ScanJobRow, counts: RuntimeJobCompletionCounts): Promise<ScanJobRow> {
    return transition(job, "succeeded", {
      request_count: counts.requestCount,
      redirect_count: counts.redirectCount,
      finding_count: counts.findingCount,
      failure_code: null,
      blocked_reason: null,
      finished_at: new Date().toISOString(),
    });
  }

  function markFailed(job: ScanJobRow, failureCode: string): Promise<ScanJobRow> {
    return transition(job, "failed", {
      failure_code: safeCode(failureCode),
      finished_at: new Date().toISOString(),
    });
  }

  function markCancelled(job: ScanJobRow): Promise<ScanJobRow> {
    return transition(job, "cancelled", {
      finished_at: new Date().toISOString(),
      failure_code: null,
    });
  }

  async function requestCancellation(jobId: string, workspaceId: string): Promise<ScanJobRow | null> {
    const requestedAt = new Date().toISOString();
    const { data, error } = await admin
      .from("scan_jobs")
      .update({ cancel_requested_at: requestedAt })
      .eq("id", jobId)
      .eq("workspace_id", workspaceId)
      .eq("job_kind", "passive_runtime")
      .in("status", ["queued", "running"])
      .is("cancel_requested_at", null)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async function persistObservations(
    job: ScanJobRow,
    observations: readonly RuntimeObservation[],
    maximumBytes: number,
  ): Promise<void> {
    if (job.status !== "running") {
      throw new Error("Runtime observations can only be persisted for a running job.");
    }
    const rows = normalizeRuntimeObservationPayloads(observations, maximumBytes);
    if (rows.length === 0) return;

    const { error } = await admin.from("runtime_observations").insert(
      rows.map((row) => ({
        workspace_id: job.workspace_id,
        job_id: job.id,
        asset_id: job.asset_id,
        sequence: row.sequence,
        kind: row.kind,
        payload: row.payload,
      })),
    );
    if (error) throw new Error(error.message);
  }

  async function listObservations(jobId: string, workspaceId: string): Promise<RuntimeObservationRow[]> {
    const { data, error } = await admin
      .from("runtime_observations")
      .select("*")
      .eq("job_id", jobId)
      .eq("workspace_id", workspaceId)
      .order("sequence", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  return Object.freeze({
    enqueue,
    load,
    loadForWorkspace,
    markRunning,
    markBlocked,
    markSucceeded,
    markFailed,
    markCancelled,
    requestCancellation,
    persistObservations,
    listObservations,
  });
}

export type RuntimeObservationRepository = ReturnType<typeof createRuntimeObservationRepository>;
