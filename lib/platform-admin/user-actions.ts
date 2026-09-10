import type { PlatformAdminRole } from "@/lib/platform-admin/types";
import {
  PlatformAdminAuthorizationError,
  assertCanModeratePlatformUser,
  requirePlatformAdmin,
} from "@/lib/platform-admin/authorization";
import type { Phase10cDatabase } from "@/lib/database.phase10c.types";
import { createAdminClient } from "@/lib/supabase/admin";

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUSPEND_BAN_DURATION = "876000h";
const RESTORE_BAN_DURATION = "none";

export type PlatformAdminUserActionErrorCode =
  | "INVALID_ADMIN_USER_ID"
  | "INVALID_ADMIN_REASON"
  | "PLATFORM_ADMIN_USER_NOT_FOUND"
  | "USER_DELETE_CONFIRMATION_MISMATCH"
  | "USER_OWNS_SHARED_WORKSPACE"
  | "PLATFORM_ADMIN_USER_ACTION_FAILED";

export class PlatformAdminUserActionError extends Error {
  constructor(public readonly code: PlatformAdminUserActionErrorCode, message: string) {
    super(message);
    this.name = "PlatformAdminUserActionError";
  }
}

export interface PlatformAdminUserActionDependencies {
  authorize(): Promise<{ actorUserId: string; actorRole: PlatformAdminRole }>;
  getUser(userId: string): Promise<{ id: string; email: string | null }>;
  getPlatformRole(userId: string): Promise<PlatformAdminRole | null>;
  updateAuthUser(userId: string, attributes: { ban_duration: string }): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
  listOwnedWorkspaces(userId: string): Promise<Array<{ id: string; name: string }>>;
  countWorkspaceMembers(workspaceId: string): Promise<number>;
  deleteWorkspace(workspaceId: string): Promise<void>;
  writeAuditEvent(input: {
    actorUserId: string;
    action: string;
    targetUserId: string | null;
    targetWorkspaceId?: string | null;
    reason: string;
    metadata?: Record<string, string | number | boolean | null>;
  }): Promise<void>;
}

function validateUserId(userId: string): string {
  const normalized = userId.trim();
  if (!USER_ID_PATTERN.test(normalized)) {
    throw new PlatformAdminUserActionError("INVALID_ADMIN_USER_ID", "Choose a valid platform user.");
  }
  return normalized;
}

function validateReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length < 1 || normalized.length > 500) {
    throw new PlatformAdminUserActionError(
      "INVALID_ADMIN_REASON",
      "Administrative reasons must contain 1 to 500 characters.",
    );
  }
  return normalized;
}

function createDefaultDependencies(): PlatformAdminUserActionDependencies {
  const admin = createAdminClient<Phase10cDatabase>();

  return {
    authorize: async () => {
      const context = await requirePlatformAdmin();
      return { actorUserId: context.user.id, actorRole: context.role };
    },
    getUser: async (userId) => {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error || !data.user) {
        throw new PlatformAdminUserActionError("PLATFORM_ADMIN_USER_NOT_FOUND", "Platform user was not found.");
      }
      return { id: data.user.id, email: data.user.email ?? null };
    },
    getPlatformRole: async (userId) => {
      const { data, error } = await admin
        .from("platform_admins")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error("PLATFORM_ADMIN_ROLE_LOOKUP_FAILED");
      return data?.role ?? null;
    },
    updateAuthUser: async (userId, attributes) => {
      const { error } = await admin.auth.admin.updateUserById(userId, attributes);
      if (error) throw new Error("AUTH_ADMIN_UPDATE_FAILED");
    },
    deleteAuthUser: async (userId) => {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error("AUTH_ADMIN_DELETE_FAILED");
    },
    listOwnedWorkspaces: async (userId) => {
      const { data, error } = await admin
        .from("workspaces")
        .select("id,name")
        .eq("created_by", userId)
        .order("created_at", { ascending: true });
      if (error) throw new Error("OWNED_WORKSPACE_LOOKUP_FAILED");
      return data ?? [];
    },
    countWorkspaceMembers: async (workspaceId) => {
      const { count, error } = await admin
        .from("workspace_members")
        .select("user_id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);
      if (error) throw new Error("WORKSPACE_MEMBER_COUNT_FAILED");
      return count ?? 0;
    },
    deleteWorkspace: async (workspaceId) => {
      const { error } = await admin.from("workspaces").delete().eq("id", workspaceId);
      if (error) throw new Error("PERSONAL_WORKSPACE_DELETE_FAILED");
    },
    writeAuditEvent: async (input) => {
      const { error } = await admin.from("platform_admin_audit_events").insert({
        actor_user_id: input.actorUserId,
        action: input.action,
        target_user_id: input.targetUserId,
        target_workspace_id: input.targetWorkspaceId ?? null,
        reason: input.reason,
        metadata: input.metadata ?? {},
      });
      if (error) throw new Error("PLATFORM_ADMIN_AUDIT_WRITE_FAILED");
    },
  };
}

async function resolveModerationTarget(
  userId: string,
  reason: string,
  dependencies?: PlatformAdminUserActionDependencies,
) {
  const deps = dependencies ?? createDefaultDependencies();
  const targetUserId = validateUserId(userId);
  const normalizedReason = validateReason(reason);
  const actor = await deps.authorize();

  try {
    const target = await deps.getUser(targetUserId);
    const targetPlatformRole = await deps.getPlatformRole(targetUserId);
    assertCanModeratePlatformUser({
      actorUserId: actor.actorUserId,
      actorRole: actor.actorRole,
      targetUserId,
      targetPlatformRole,
      operation: "suspend",
    });
    return { deps, actor, target, targetUserId, normalizedReason, targetPlatformRole };
  } catch (error) {
    if (error instanceof PlatformAdminAuthorizationError || error instanceof PlatformAdminUserActionError) throw error;
    throw new PlatformAdminUserActionError(
      "PLATFORM_ADMIN_USER_ACTION_FAILED",
      "The platform user action could not be completed safely.",
    );
  }
}

export async function suspendPlatformUser(
  input: { userId: string; reason: string },
  dependencies?: PlatformAdminUserActionDependencies,
): Promise<void> {
  const context = await resolveModerationTarget(input.userId, input.reason, dependencies);
  assertCanModeratePlatformUser({
    actorUserId: context.actor.actorUserId,
    actorRole: context.actor.actorRole,
    targetUserId: context.targetUserId,
    targetPlatformRole: context.targetPlatformRole,
    operation: "suspend",
  });

  try {
    await context.deps.updateAuthUser(context.targetUserId, { ban_duration: SUSPEND_BAN_DURATION });
    await context.deps.writeAuditEvent({
      actorUserId: context.actor.actorUserId,
      action: "user.suspended",
      targetUserId: context.targetUserId,
      reason: context.normalizedReason,
      metadata: { banDuration: SUSPEND_BAN_DURATION },
    });
  } catch (error) {
    if (error instanceof PlatformAdminAuthorizationError || error instanceof PlatformAdminUserActionError) throw error;
    throw new PlatformAdminUserActionError(
      "PLATFORM_ADMIN_USER_ACTION_FAILED",
      "The platform user action could not be completed safely.",
    );
  }
}

export async function restorePlatformUser(
  input: { userId: string; reason: string },
  dependencies?: PlatformAdminUserActionDependencies,
): Promise<void> {
  const context = await resolveModerationTarget(input.userId, input.reason, dependencies);
  assertCanModeratePlatformUser({
    actorUserId: context.actor.actorUserId,
    actorRole: context.actor.actorRole,
    targetUserId: context.targetUserId,
    targetPlatformRole: context.targetPlatformRole,
    operation: "restore",
  });

  try {
    await context.deps.updateAuthUser(context.targetUserId, { ban_duration: RESTORE_BAN_DURATION });
    await context.deps.writeAuditEvent({
      actorUserId: context.actor.actorUserId,
      action: "user.restored",
      targetUserId: context.targetUserId,
      reason: context.normalizedReason,
      metadata: {},
    });
  } catch (error) {
    if (error instanceof PlatformAdminAuthorizationError || error instanceof PlatformAdminUserActionError) throw error;
    throw new PlatformAdminUserActionError(
      "PLATFORM_ADMIN_USER_ACTION_FAILED",
      "The platform user action could not be completed safely.",
    );
  }
}

export async function hardDeletePlatformUser(
  input: { userId: string; emailConfirmation: string; reason: string },
  dependencies?: PlatformAdminUserActionDependencies,
): Promise<void> {
  const context = await resolveModerationTarget(input.userId, input.reason, dependencies);
  assertCanModeratePlatformUser({
    actorUserId: context.actor.actorUserId,
    actorRole: context.actor.actorRole,
    targetUserId: context.targetUserId,
    targetPlatformRole: context.targetPlatformRole,
    operation: "delete",
  });

  try {
    const freshEmail = context.target.email?.trim() ?? "";
    if (!freshEmail || input.emailConfirmation.trim() !== freshEmail) {
      throw new PlatformAdminUserActionError(
        "USER_DELETE_CONFIRMATION_MISMATCH",
        "Type the user's current email address exactly to confirm hard deletion.",
      );
    }

    const ownedWorkspaces = await context.deps.listOwnedWorkspaces(context.targetUserId);
    for (const workspace of ownedWorkspaces) {
      const memberCount = await context.deps.countWorkspaceMembers(workspace.id);
      if (memberCount > 1) {
        throw new PlatformAdminUserActionError(
          "USER_OWNS_SHARED_WORKSPACE",
          "This user owns a workspace with other members. Transfer ownership before hard deletion.",
        );
      }
    }

    await context.deps.writeAuditEvent({
      actorUserId: context.actor.actorUserId,
      action: "user.delete_started",
      targetUserId: context.targetUserId,
      reason: context.normalizedReason,
      metadata: { personalWorkspaceCount: ownedWorkspaces.length },
    });

    for (const workspace of ownedWorkspaces) {
      await context.deps.deleteWorkspace(workspace.id);
    }

    await context.deps.deleteAuthUser(context.targetUserId);
    await context.deps.writeAuditEvent({
      actorUserId: context.actor.actorUserId,
      action: "user.deleted",
      targetUserId: context.targetUserId,
      reason: context.normalizedReason,
      metadata: { personalWorkspaceCount: ownedWorkspaces.length },
    });
  } catch (error) {
    if (error instanceof PlatformAdminAuthorizationError || error instanceof PlatformAdminUserActionError) throw error;
    throw new PlatformAdminUserActionError(
      "PLATFORM_ADMIN_USER_ACTION_FAILED",
      "The platform user action could not be completed safely.",
    );
  }
}
