import type { User } from "@supabase/supabase-js";
import type { Phase10cDatabase } from "@/lib/database.phase10c.types";
import { enforceAssuranceForRole } from "@/lib/auth/assurance-server";
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

export type PlatformAdminAccessState =
  | { status: "authorized"; context: PlatformAdminContext }
  | { status: "unauthenticated" }
  | { status: "denied" };

export async function getPlatformAdminAccessState(
  { enforceMfa = true }: { enforceMfa?: boolean } = {},
): Promise<PlatformAdminAccessState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "unauthenticated" };

  const admin = createAdminClient<Phase10cDatabase>();
  const { data, error } = await admin
    .from("platform_admins")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return { status: "denied" };
  assertPlatformAdminRole(data.role);
  if (enforceMfa) {
    await enforceAssuranceForRole(supabase.auth, "platform-admin", "/admin");
  }
  return { status: "authorized", context: { user, role: data.role } };
}

export async function getOptionalPlatformAdmin(): Promise<PlatformAdminContext | null> {
  const state = await getPlatformAdminAccessState({ enforceMfa: false });
  return state.status === "authorized" ? state.context : null;
}

export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const state = await getPlatformAdminAccessState();
  if (state.status === "unauthenticated") {
    throw new PlatformAdminAuthorizationError(
      "PLATFORM_ADMIN_UNAUTHENTICATED",
      "Sign in to continue.",
    );
  }
  if (state.status === "denied") {
    throw new PlatformAdminAuthorizationError(
      "PLATFORM_ADMIN_ACCESS_DENIED",
      "Platform administrator access is required.",
    );
  }
  return state.context;
}
