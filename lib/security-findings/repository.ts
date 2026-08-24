import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  FindingLifecycleState,
} from "@/lib/database.types";

type SecurityFindingRow = Database["public"]["Tables"]["security_findings"]["Row"];
type SecurityEvidenceRow = Database["public"]["Tables"]["security_evidence"]["Row"];
type SecurityFindingOccurrenceRow = Database["public"]["Tables"]["security_finding_occurrences"]["Row"];
type SecurityFindingEventRow = Database["public"]["Tables"]["security_finding_events"]["Row"];

const FINDING_READ_LIMIT = 100;

export interface SecurityFindingDetail {
  finding: SecurityFindingRow;
  evidence: SecurityEvidenceRow[];
  occurrences: SecurityFindingOccurrenceRow[];
  events: SecurityFindingEventRow[];
}

export interface ChangeFindingLifecycleRepositoryInput {
  workspaceId: string;
  findingId: string;
  expectedLifecycle: FindingLifecycleState;
  nextLifecycle: FindingLifecycleState;
  actorId: string;
  reason: string | null;
}

function isSecurityFindingRow(value: unknown): value is SecurityFindingRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<SecurityFindingRow>;
  return typeof row.workspace_id === "string"
    && typeof row.finding_id === "string"
    && typeof row.asset_id === "string"
    && typeof row.lifecycle_state === "string";
}

export function createSecurityFindingRepository(client: SupabaseClient<Database>) {
  async function loadFinding(
    workspaceId: string,
    findingId: string,
  ): Promise<SecurityFindingRow | null> {
    const { data, error } = await client
      .from("security_findings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("finding_id", findingId)
      .maybeSingle();

    if (error) throw new Error("Unable to load the security finding.");
    return data;
  }

  async function listWorkspaceFindings(
    workspaceId: string,
  ): Promise<SecurityFindingRow[]> {
    const { data, error } = await client
      .from("security_findings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("last_seen_at", { ascending: false })
      .limit(100);

    if (error) throw new Error("Unable to load workspace security findings.");
    return data ?? [];
  }

  async function loadWorkspaceFindingDetail(
    workspaceId: string,
    findingId: string,
  ): Promise<SecurityFindingDetail | null> {
    const { data: finding, error: findingError } = await client
      .from("security_findings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("finding_id", findingId)
      .maybeSingle();
    if (findingError) throw new Error("Unable to load the security finding.");
    if (!finding) return null;

    const { data: evidenceLinks, error: linksError } = await client
      .from("security_finding_evidence")
      .select("evidence_id")
      .eq("workspace_id", workspaceId)
      .eq("finding_id", findingId)
      .limit(100);
    if (linksError) throw new Error("Unable to load finding evidence links.");

    const evidenceIds = (evidenceLinks ?? []).map((link) => link.evidence_id);
    let evidence: SecurityEvidenceRow[] = [];
    if (evidenceIds.length > 0) {
      const { data: evidenceRows, error: evidenceError } = await client
        .from("security_evidence")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("evidence_id", evidenceIds)
        .order("created_at", { ascending: true })
        .limit(100);
      if (evidenceError) throw new Error("Unable to load finding evidence.");
      evidence = evidenceRows ?? [];
    }

    const { data: occurrences, error: occurrencesError } = await client
      .from("security_finding_occurrences")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("finding_id", findingId)
      .order("observed_at", { ascending: false })
      .limit(100);
    if (occurrencesError) throw new Error("Unable to load finding occurrences.");

    const { data: events, error: eventsError } = await client
      .from("security_finding_events")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("finding_id", findingId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (eventsError) throw new Error("Unable to load finding lifecycle history.");

    return {
      finding,
      evidence,
      occurrences: occurrences ?? [],
      events: events ?? [],
    };
  }

  async function changeLifecycle(
    input: ChangeFindingLifecycleRepositoryInput,
  ): Promise<SecurityFindingRow> {
    const { data, error } = await client.rpc("change_security_finding_lifecycle", {
      target_workspace_id: input.workspaceId,
      target_finding_id: input.findingId,
      expected_lifecycle: input.expectedLifecycle,
      next_lifecycle: input.nextLifecycle,
      target_actor_id: input.actorId,
      event_reason: input.reason,
    });

    if (error) throw new Error("Unable to change the security finding lifecycle.");
    if (!isSecurityFindingRow(data)) {
      throw new Error("Security finding lifecycle response was invalid.");
    }
    return data;
  }

  return Object.freeze({
    loadFinding,
    listWorkspaceFindings,
    loadWorkspaceFindingDetail,
    changeLifecycle,
  });
}

export type SecurityFindingRepository = ReturnType<typeof createSecurityFindingRepository>;
