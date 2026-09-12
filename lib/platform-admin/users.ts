import type { WorkspaceRole } from "@/lib/database.types";
import type { Phase10cDatabase } from "@/lib/database.phase10c.types";
import { requirePlatformAdmin } from "@/lib/platform-admin/authorization";
import type { PlatformAdminRole } from "@/lib/platform-admin/types";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_QUERY_LENGTH = 120;
const MAX_SEARCH_USERS = 1000;
const SEARCH_BATCH_SIZE = 100;

export type PlatformUserStatus = "active" | "unconfirmed" | "suspended";

export interface PlatformAuthUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  created_at: string;
  last_sign_in_at?: string | null;
  confirmed_at?: string | null;
  email_confirmed_at?: string | null;
  banned_until?: string | null;
  user_metadata?: Record<string, unknown>;
}

export interface PlatformUserSummary {
  id: string;
  email: string | null;
  displayName: string;
  createdAt: string;
  lastSignInAt: string | null;
  confirmedAt: string | null;
  status: PlatformUserStatus;
  platformRole: PlatformAdminRole | null;
  workspaceCount: number;
}

export interface PlatformUserWorkspaceMembership {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface PlatformUserDetail {
  user: PlatformUserSummary;
  workspaces: PlatformUserWorkspaceMembership[];
}

export interface PlatformUserListInput {
  page?: number;
  perPage?: number;
  query?: string;
}

export interface PlatformUserListResult {
  users: PlatformUserSummary[];
  page: number;
  perPage: number;
  hasNextPage: boolean;
  totalMatches: number | null;
  searchTruncated: boolean;
}

export interface PlatformAdminUsersDependencies {
  authorize(): Promise<void>;
  listAuthUsers(page: number, perPage: number): Promise<PlatformAuthUser[]>;
  getAuthUser(userId: string): Promise<PlatformAuthUser>;
  getPlatformRoles(userIds: string[]): Promise<Record<string, PlatformAdminRole>>;
  getWorkspaceCounts(userIds: string[]): Promise<Record<string, number>>;
  getProfile(userId: string): Promise<{ displayName: string | null } | null>;
  getMemberships(userId: string): Promise<Array<{ workspaceId: string; role: WorkspaceRole; joinedAt: string }>>;
  getWorkspaces(workspaceIds: string[]): Promise<Array<{ id: string; name: string; slug: string }>>;
}

export type PlatformAdminReadErrorCode = "PLATFORM_ADMIN_READ_FAILED" | "PLATFORM_ADMIN_USER_NOT_FOUND";

export class PlatformAdminReadError extends Error {
  constructor(public readonly code: PlatformAdminReadErrorCode, message: string) {
    super(message);
    this.name = "PlatformAdminReadError";
  }
}

function boundedPositiveInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value) || value === undefined) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

function normalizeQuery(value: string | undefined): string {
  return (value ?? "").trim().slice(0, MAX_QUERY_LENGTH).toLocaleLowerCase();
}

function displayNameFromAuthUser(user: PlatformAuthUser): string {
  const metadata = user.user_metadata ?? {};
  for (const key of ["full_name", "name"]) {
    const candidate = metadata[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().slice(0, 80);
    }
  }

  const emailLocal = user.email?.split("@", 1)[0]?.trim();
  if (emailLocal) return emailLocal.slice(0, 80);
  if (user.phone?.trim()) return user.phone.trim().slice(0, 80);
  return "ScopeForge user";
}

function isFutureTimestamp(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > now.getTime();
}

export function normalizePlatformUser(
  user: PlatformAuthUser,
  platformRole: PlatformAdminRole | null,
  now = new Date(),
  workspaceCount = 0,
): PlatformUserSummary {
  const confirmedAt = user.email_confirmed_at ?? user.confirmed_at ?? null;
  const status: PlatformUserStatus = isFutureTimestamp(user.banned_until, now)
    ? "suspended"
    : confirmedAt
      ? "active"
      : "unconfirmed";

  return {
    id: user.id,
    email: user.email ?? null,
    displayName: displayNameFromAuthUser(user),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    confirmedAt,
    status,
    platformRole,
    workspaceCount: Math.max(0, Math.floor(workspaceCount)),
  };
}

function matchesQuery(user: PlatformUserSummary, query: string): boolean {
  if (!query) return true;
  return [user.id, user.email ?? "", user.displayName]
    .some((value) => value.toLocaleLowerCase().includes(query));
}

function createDefaultDependencies(): PlatformAdminUsersDependencies {
  const admin = createAdminClient<Phase10cDatabase>();

  return {
    authorize: async () => {
      await requirePlatformAdmin();
    },
    listAuthUsers: async (page, perPage) => {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error("AUTH_ADMIN_LIST_FAILED");
      return data.users as PlatformAuthUser[];
    },
    getAuthUser: async (userId) => {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error || !data.user) {
        throw new PlatformAdminReadError("PLATFORM_ADMIN_USER_NOT_FOUND", "Platform user was not found.");
      }
      return data.user as PlatformAuthUser;
    },
    getPlatformRoles: async (userIds) => {
      if (userIds.length === 0) return {};
      const { data, error } = await admin
        .from("platform_admins")
        .select("user_id,role")
        .in("user_id", userIds);
      if (error) throw new Error("PLATFORM_ADMIN_ROLE_LOOKUP_FAILED");

      return Object.fromEntries(
        (data ?? []).map((row) => [row.user_id, row.role as PlatformAdminRole]),
      );
    },
    getWorkspaceCounts: async (userIds) => {
      if (userIds.length === 0) return {};
      const { data, error } = await admin
        .from("workspace_members")
        .select("user_id")
        .in("user_id", userIds);
      if (error) throw new Error("PLATFORM_WORKSPACE_COUNT_FAILED");
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
      return counts;
    },
    getProfile: async (userId) => {
      const { data, error } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error("PLATFORM_PROFILE_LOOKUP_FAILED");
      return data ? { displayName: data.display_name } : null;
    },
    getMemberships: async (userId) => {
      const { data, error } = await admin
        .from("workspace_members")
        .select("workspace_id,role,joined_at")
        .eq("user_id", userId)
        .order("joined_at", { ascending: true });
      if (error) throw new Error("PLATFORM_MEMBERSHIP_LOOKUP_FAILED");
      return (data ?? []).map((row) => ({
        workspaceId: row.workspace_id,
        role: row.role,
        joinedAt: row.joined_at,
      }));
    },
    getWorkspaces: async (workspaceIds) => {
      if (workspaceIds.length === 0) return [];
      const { data, error } = await admin
        .from("workspaces")
        .select("id,name,slug")
        .in("id", workspaceIds);
      if (error) throw new Error("PLATFORM_WORKSPACE_LOOKUP_FAILED");
      return data ?? [];
    },
  };
}

async function enrichPlatformUsers(
  authUsers: PlatformAuthUser[],
  deps: PlatformAdminUsersDependencies,
): Promise<PlatformUserSummary[]> {
  const ids = authUsers.map((user) => user.id);
  const [roles, workspaceCounts] = await Promise.all([
    deps.getPlatformRoles(ids),
    deps.getWorkspaceCounts(ids),
  ]);
  return authUsers.map((user) => normalizePlatformUser(
    user,
    roles[user.id] ?? null,
    new Date(),
    workspaceCounts[user.id] ?? 0,
  ));
}

export async function listPlatformUsers(
  input: PlatformUserListInput = {},
  dependencies?: PlatformAdminUsersDependencies,
): Promise<PlatformUserListResult> {
  const deps = dependencies ?? createDefaultDependencies();
  await deps.authorize();

  const page = boundedPositiveInteger(input.page, 1, Number.MAX_SAFE_INTEGER);
  const perPage = boundedPositiveInteger(input.perPage, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const query = normalizeQuery(input.query);

  try {
    if (!query) {
      const authUsers = await deps.listAuthUsers(page, perPage);
      return {
        users: await enrichPlatformUsers(authUsers, deps),
        page,
        perPage,
        hasNextPage: authUsers.length === perPage,
        totalMatches: null,
        searchTruncated: false,
      };
    }

    const scanned: PlatformAuthUser[] = [];
    let sourcePage = 1;
    let reachedProviderEnd = false;

    while (scanned.length < MAX_SEARCH_USERS) {
      const batch = await deps.listAuthUsers(sourcePage, SEARCH_BATCH_SIZE);
      scanned.push(...batch.slice(0, MAX_SEARCH_USERS - scanned.length));
      if (batch.length < SEARCH_BATCH_SIZE) {
        reachedProviderEnd = true;
        break;
      }
      sourcePage += 1;
    }

    const enriched = await enrichPlatformUsers(scanned, deps);
    const matches = enriched.filter((user) => matchesQuery(user, query));
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const searchTruncated = !reachedProviderEnd && scanned.length >= MAX_SEARCH_USERS;

    return {
      users: matches.slice(start, end),
      page,
      perPage,
      hasNextPage: matches.length > end || searchTruncated,
      totalMatches: searchTruncated ? null : matches.length,
      searchTruncated,
    };
  } catch (error) {
    if (error instanceof PlatformAdminReadError) throw error;
    throw new PlatformAdminReadError(
      "PLATFORM_ADMIN_READ_FAILED",
      "Unable to load platform user data.",
    );
  }
}

export async function getPlatformUser(
  userId: string,
  dependencies?: PlatformAdminUsersDependencies,
): Promise<PlatformUserDetail> {
  const deps = dependencies ?? createDefaultDependencies();
  await deps.authorize();

  try {
    const user = await deps.getAuthUser(userId);
    const [roles, profile, memberships] = await Promise.all([
      deps.getPlatformRoles([user.id]),
      deps.getProfile(user.id),
      deps.getMemberships(user.id),
    ]);
    const workspaces = await deps.getWorkspaces(memberships.map((membership) => membership.workspaceId));
    const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
    const normalized = normalizePlatformUser(user, roles[user.id] ?? null, new Date(), memberships.length);

    if (profile?.displayName?.trim()) {
      normalized.displayName = profile.displayName.trim().slice(0, 80);
    }

    return {
      user: normalized,
      workspaces: memberships.flatMap((membership) => {
        const workspace = workspaceById.get(membership.workspaceId);
        if (!workspace) return [];
        return [{
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          role: membership.role,
          joinedAt: membership.joinedAt,
        }];
      }),
    };
  } catch (error) {
    if (error instanceof PlatformAdminReadError) throw error;
    throw new PlatformAdminReadError(
      "PLATFORM_ADMIN_READ_FAILED",
      "Unable to load platform user data.",
    );
  }
}
