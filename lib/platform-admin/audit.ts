import type { Json } from "@/lib/database.types";
import type { Phase10cDatabase } from "@/lib/database.phase10c.types";
import { requirePlatformAdmin } from "@/lib/platform-admin/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export interface PlatformAdminAuditEvent {
  id: string;
  actorUserId: string;
  action: string;
  targetUserId: string | null;
  targetWorkspaceId: string | null;
  reason: string;
  metadata: Json;
  createdAt: string;
}

export interface PlatformAdminAuditPage {
  events: PlatformAdminAuditEvent[];
  page: number;
  perPage: number;
  hasNextPage: boolean;
}

export class PlatformAdminAuditReadError extends Error {
  readonly code = "PLATFORM_ADMIN_AUDIT_READ_FAILED" as const;

  constructor() {
    super("Unable to load the platform administration audit trail.");
    this.name = "PlatformAdminAuditReadError";
  }
}

function positiveInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

export async function listPlatformAdminAuditEvents(input: {
  page?: number;
  perPage?: number;
} = {}): Promise<PlatformAdminAuditPage> {
  await requirePlatformAdmin();
  const admin = createAdminClient<Phase10cDatabase>();
  const page = positiveInteger(input.page, 1, Number.MAX_SAFE_INTEGER);
  const perPage = positiveInteger(input.perPage, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const start = (page - 1) * perPage;
  const end = start + perPage;

  try {
    const { data, error } = await admin
      .from("platform_admin_audit_events")
      .select("id,actor_user_id,action,target_user_id,target_workspace_id,reason,metadata,created_at")
      .order("created_at", { ascending: false })
      .range(start, end);
    if (error) throw new Error("PLATFORM_ADMIN_AUDIT_QUERY_FAILED");

    const rows = data ?? [];
    return {
      events: rows.slice(0, perPage).map((row) => ({
        id: row.id,
        actorUserId: row.actor_user_id,
        action: row.action,
        targetUserId: row.target_user_id,
        targetWorkspaceId: row.target_workspace_id,
        reason: row.reason,
        metadata: row.metadata,
        createdAt: row.created_at,
      })),
      page,
      perPage,
      hasNextPage: rows.length > perPage,
    };
  } catch {
    throw new PlatformAdminAuditReadError();
  }
}
