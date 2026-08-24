import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  FindingLifecycleState,
} from "@/lib/database.types";

type SecurityFindingRow = Database["public"]["Tables"]["security_findings"]["Row"];

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

  return Object.freeze({ loadFinding, changeLifecycle });
}

export type SecurityFindingRepository = ReturnType<typeof createSecurityFindingRepository>;
