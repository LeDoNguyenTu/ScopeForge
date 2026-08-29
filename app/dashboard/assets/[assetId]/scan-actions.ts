"use server";

import { revalidatePath } from "next/cache";
import type { Phase6cDatabase } from "@/lib/database.phase6c.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type HostedRepositoryScanActionResult =
  | { ok: true; data: { taskId: string } }
  | { ok: false; error: { code: string; message: string } };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED = false;

function enqueueResult(value: unknown): { taskId: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.taskId === "string" && UUID_PATTERN.test(candidate.taskId)
    ? { taskId: candidate.taskId }
    : null;
}

function safeEnqueueFailure(message: string): HostedRepositoryScanActionResult {
  const known: Record<string, string> = {
    REPOSITORY_SCAN_ACCESS_DENIED: "Only workspace owners and admins can request hosted repository scans.",
    REPOSITORY_SCAN_ASSET_MISMATCH: "The selected asset is not an eligible repository.",
    REPOSITORY_SCAN_SNAPSHOT_NOT_AVAILABLE: "Create a fresh private source snapshot before requesting a hosted scan.",
    REPOSITORY_SCAN_COOLDOWN: "A hosted scan was requested for this repository recently. Try again after the cooldown.",
    REPOSITORY_SCAN_ACTIVE_LIMIT: "This workspace already has an active hosted repository scan.",
    REPOSITORY_SCAN_DAILY_LIMIT: "This workspace has reached the daily hosted repository scan limit.",
  };
  const code = Object.keys(known).find((candidate) => message.includes(candidate))
    ?? "REPOSITORY_SCAN_REQUEST_FAILED";
  return {
    ok: false,
    error: {
      code,
      message: known[code] ?? "The hosted repository scan could not be queued safely.",
    },
  };
}

export async function requestHostedRepositoryScan(assetId: string): Promise<HostedRepositoryScanActionResult> {
  if (!UUID_PATTERN.test(assetId)) {
    return { ok: false, error: { code: "INVALID_ASSET_ID", message: "The selected repository asset is invalid." } };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in to request a hosted repository scan." } };
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id,workspace_id,kind")
    .eq("id", assetId)
    .maybeSingle();
  if (assetError || !asset) {
    return { ok: false, error: { code: "ASSET_NOT_FOUND", message: "The selected repository asset was not found." } };
  }
  if (asset.kind !== "repository") {
    return { ok: false, error: { code: "REPOSITORY_REQUIRED", message: "Hosted repository scans are available only for repository assets." } };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", asset.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership) {
    return { ok: false, error: { code: "WORKSPACE_ACCESS_DENIED", message: "You no longer have access to this repository workspace." } };
  }
  if (membership.role !== "owner" && membership.role !== "admin") {
    return { ok: false, error: { code: "REPOSITORY_SCAN_ACCESS_DENIED", message: "Only workspace owners and admins can request hosted repository scans." } };
  }

  if (!HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED) {
    return {
      ok: false,
      error: {
        code: "REPOSITORY_SCAN_RUNTIME_UNAVAILABLE",
        message: "Hosted repository scanning remains disabled until the isolated production worker passes its runtime acceptance gate.",
      },
    };
  }

  try {
    const admin = createAdminClient<Phase6cDatabase>();
    const { data, error } = await admin.rpc("enqueue_repository_scan_worker_task", {
      target_workspace_id: asset.workspace_id,
      target_asset_id: asset.id,
      target_actor_id: user.id,
    });
    if (error) return safeEnqueueFailure(error.message);
    const queued = enqueueResult(data);
    if (!queued) return safeEnqueueFailure("REPOSITORY_SCAN_REQUEST_FAILED");

    revalidatePath(`/dashboard/assets/${asset.id}`);
    return { ok: true, data: queued };
  } catch {
    return safeEnqueueFailure("REPOSITORY_SCAN_REQUEST_FAILED");
  }
}
