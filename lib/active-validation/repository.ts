import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Json,
  ScanJobStatus,
} from "@/lib/database.types";
import type { CorsPolicyObservation } from "@/packages/runtime-validator";
import type {
  ActiveValidationJobCompletionCounts,
  EnqueueActiveValidationJobInput,
} from "./types";

type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];
type RuntimeObservationRow = Database["public"]["Tables"]["runtime_observations"]["Row"];

const ALLOWED_TRANSITIONS: Readonly<Record<ScanJobStatus, readonly ScanJobStatus[]>> = Object.freeze({
  queued: Object.freeze(["running", "blocked", "cancelled"] as const),
  running: Object.freeze(["succeeded", "failed", "blocked", "cancelled"] as const),
  succeeded: Object.freeze([]),
  failed: Object.freeze([]),
  blocked: Object.freeze([]),
  cancelled: Object.freeze([]),
});

function safeCode(value: string): string {
  return value.trim().slice(0, 64) || "ACTIVE_VALIDATION_FAILED";
}

function safeReason(value: string): string {
  return value.trim().slice(0, 500) || "Active validation was blocked by policy.";
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function assertActiveValidationJobTransition(
  current: ScanJobStatus,
  next: ScanJobStatus,
): void {
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new Error(`Invalid active validation job transition: ${current} -> ${next}`);
  }
}

export function normalizeCorsPolicyObservationPayload(
  observation: CorsPolicyObservation,
  maximumBytes: number,
): Readonly<{ sequence: 0; kind: "cors-policy"; payload: Json }> {
  if (!Number.isInteger(maximumBytes) || maximumBytes <= 0) {
    throw new Error("Active observation persistence budget must be a positive integer.");
  }
  if (observation.kind !== "cors-policy") {
    throw new Error("Active validation persists cors-policy observations only.");
  }

  const payload = toJson(observation);
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > maximumBytes) {
    throw new Error("Active observation persistence budget exceeded.");
  }

  return Object.freeze({ sequence: 0 as const, kind: "cors-policy" as const, payload });
}

export function createActiveValidationRepository(admin: SupabaseClient<Database>) {
  async function enqueue(input: EnqueueActiveValidationJobInput): Promise<ScanJobRow> {
    const { data, error } = await admin
      .from("scan_jobs")
      .insert({
        workspace_id: input.workspaceId,
        asset_id: input.assetId,
        job_kind: "active_validation",
        status: "queued",
        requested_by: input.requestedBy,
        blocked_reason: null,
        authorization_canonical_target: input.canonicalTarget,
        authorization_asset_kind: input.assetKind,
        authorization_verified_at: input.verifiedAt,
        validation_profile_id: input.profileId,
        validation_profile_version: input.profileVersion,
        authorization_granted_at: input.authorizationGrantedAt,
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
      .eq("job_kind", "active_validation")
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
      .eq("job_kind", "active_validation")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async function transition(
    job: ScanJobRow,
    next: ScanJobStatus,
    patch: Database["public"]["Tables"]["scan_jobs"]["Update"] = {},
  ): Promise<ScanJobRow> {
    assertActiveValidationJobTransition(job.status, next);
    const { data, error } = await admin
      .from("scan_jobs")
      .update({ ...patch, status: next })
      .eq("id", job.id)
      .eq("workspace_id", job.workspace_id)
      .eq("job_kind", "active_validation")
      .eq("status", job.status)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Active validation job transition conflict.");
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

  function markSucceeded(
    job: ScanJobRow,
    counts: ActiveValidationJobCompletionCounts,
  ): Promise<ScanJobRow> {
    return transition(job, "succeeded", {
      request_count: counts.requestCount,
      redirect_count: 0,
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
    const { data, error } = await admin
      .from("scan_jobs")
      .update({ cancel_requested_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("workspace_id", workspaceId)
      .eq("job_kind", "active_validation")
      .in("status", ["queued", "running"])
      .is("cancel_requested_at", null)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async function persistObservation(
    job: ScanJobRow,
    observation: CorsPolicyObservation,
    maximumBytes: number,
  ): Promise<void> {
    if (job.status !== "running" || job.job_kind !== "active_validation") {
      throw new Error("Active observations can only be persisted for a running active validation job.");
    }
    const row = normalizeCorsPolicyObservationPayload(observation, maximumBytes);
    const { error } = await admin.from("runtime_observations").insert({
      workspace_id: job.workspace_id,
      job_id: job.id,
      asset_id: job.asset_id,
      sequence: row.sequence,
      kind: "cors-policy",
      payload: row.payload,
    });
    if (error) throw new Error(error.message);
  }

  async function listObservations(jobId: string, workspaceId: string): Promise<RuntimeObservationRow[]> {
    const { data, error } = await admin
      .from("runtime_observations")
      .select("*")
      .eq("job_id", jobId)
      .eq("workspace_id", workspaceId)
      .eq("kind", "cors-policy")
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
    persistObservation,
    listObservations,
  });
}

export type ActiveValidationRepository = ReturnType<typeof createActiveValidationRepository>;
