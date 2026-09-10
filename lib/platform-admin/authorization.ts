import type { User } from "@supabase/supabase-js";
import type { Phase10cDatabase } from "@/lib/database.phase10c.types";
import type { PlatformAdminRole } from "@/lib/platform-admin/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PlatformAdminErrorCode =
  | "PLATFORM_ADMIN_UNAUTHENTICATED"
  | "PLATFORM_ADMIN_ACCESS_DENIED"
  | "PLATFORM_ADMIN_SELF_ACTION_DENIED"
  | "PLATFORM_ADMIN_TARGET_PROTECTED";

export class PlatformAdminAuthorizationError extends Error {
  constructor(public readonly code: PlatformAdminErrorCode, message: string) {
    super(message);
    this.name = "PlatformAdminAuthorizationError";
  }
}

export function assertPlatformAdminRole(role: unknown): asserts role is PlatformAdminRole {
  if (role !== "owner" && role !== "admin") {
    throw new PlatformAdminAuthorizationError(
      "PLATFORM_ADMIN_ACCESS_DENIED",
      "Platform administrator access is required.",
    );
  }
}

export function assertCanModeratePlatformUser(input: {
  actorUserId: string;
  actorRole: PlatformAdminRole;
  targetUserId: string;
  targetPlatformRole: PlatformAdminRole | null;
  operation: "suspend" | "restore" | "delete";
}): void {
  assertPlatformAdminRole(input.actorRole);
  if (input.actorUserId === input.targetUserId) {
    throw new PlatformAdminAuthorizationError(
      "PLATFORM_ADMIN_SELF_ACTION_DENIED",
      `A platform administrator cannot ${input.operation} their own account.`,
    );
  }
  if (input.targetPlatformRole) {
    throw new PlatformAdminAuthorizationError(
      "PLATFORM_ADMIN_TARGET_PROTECTED",
      "Platform administrator accounts are protected from routine user moderation.",
    );
  }
}

export interface PlatformAdminContext {
  user: User;
  role: PlatformAdminRole;
}

export async function getOptionalPlatformAdmin(): Promise<PlatformAdminContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient<Phase10cDatabase>();
  const { data, error } = await admin
    .from("platform_admins")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  assertPlatformAdminRole(data.role);
  return { user, role: data.role };
}

export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new PlatformAdminAuthorizationError(
      "PLATFORM_ADMIN_UNAUTHENTICATED",
      "Sign in to continue.",
    );
  }

  const admin = createAdminClient<Phase10cDatabase>();
  const { data, error } = await admin
    .from("platform_admins")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    throw new PlatformAdminAuthorizationError(
      "PLATFORM_ADMIN_ACCESS_DENIED",
      "Platform administrator access is required.",
    );
  }
  assertPlatformAdminRole(data.role);
  return { user, role: data.role };
}
