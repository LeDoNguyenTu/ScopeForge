"use server";

import { revalidatePath } from "next/cache";
import { createRepositorySnapshotRepository } from "@/lib/repository-snapshots/repository";
import { HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED } from "@/lib/repository-snapshots/runtime";
import { requestRepositorySnapshot as enqueueRepositorySnapshot } from "@/lib/repository-snapshots/service";
import { RepositorySnapshotError } from "@/lib/repository-snapshots/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type RepositorySnapshotActionResult =
  | { ok: true; data: { taskId: string } }
  | { ok: false; error: { code: string; message: string } };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeFailure(error: unknown): RepositorySnapshotActionResult {
  if (error instanceof RepositorySnapshotError) {
    const messages: Partial<Record<RepositorySnapshotError["code"], string>> = {
      REPOSITORY_SNAPSHOT_ACCESS_DENIED: "Only workspace owners and admins can request hosted repository snapshots.",
      REPOSITORY_SNAPSHOT_ASSET_MISMATCH: "The selected asset is not an eligible public GitHub repository.",
      REPOSITORY_SNAPSHOT_COOLDOWN: "A snapshot was requested for this repository recently. Try again after the five-minute cooldown.",
      REPOSITORY_SNAPSHOT_DAILY_LIMIT: "This workspace has reached the daily hosted repository snapshot limit.",
      REPOSITORY_SNAPSHOT_ACTIVE_LIMIT: "This workspace already has an active hosted repository snapshot request.",
    };
    return {
      ok: false,
      error: {
        code: error.code,
        message: messages[error.code] ?? "The repository snapshot request could not be queued safely.",
      },
    };
  }
  const code = error instanceof Error && typeof (error as Error & { code?: unknown }).code === "string"
    ? String((error as Error & { code: string }).code)
    : "REPOSITORY_SNAPSHOT_REQUEST_FAILED";
  return {
    ok: false,
    error: {
      code,
      message: "The repository snapshot request could not be queued safely.",
    },
  };
}

export async function requestRepositorySnapshot(assetId: string): Promise<RepositorySnapshotActionResult> {
  try {
    if (!UUID_PATTERN.test(assetId)) {
      return { ok: false, error: { code: "INVALID_ASSET_ID", message: "The selected repository asset is invalid." } };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in to request a repository snapshot." } };
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
      return { ok: false, error: { code: "REPOSITORY_REQUIRED", message: "Hosted source snapshots are available only for repository assets." } };
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
      return { ok: false, error: { code: "REPOSITORY_SNAPSHOT_ACCESS_DENIED", message: "Only workspace owners and admins can request hosted repository snapshots." } };
    }

    if (!HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED) {
      return {
        ok: false,
        error: {
          code: "REPOSITORY_SNAPSHOT_RUNTIME_UNAVAILABLE",
          message: "Hosted repository acquisition remains disabled until the production acquisition worker and private artifact store pass their runtime acceptance gate.",
        },
      };
    }

    const admin = createAdminClient();
    const repository = createRepositorySnapshotRepository(admin);
    const result = await enqueueRepositorySnapshot({
      workspaceId: asset.workspace_id,
      assetId: asset.id,
      actorId: user.id,
    }, { repository });

    revalidatePath(`/dashboard/assets/${asset.id}`);
    return { ok: true, data: { taskId: result.taskId } };
  } catch (error) {
    return safeFailure(error);
  }
}
