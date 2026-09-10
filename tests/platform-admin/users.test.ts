import { describe, expect, it } from "vitest";
import {
  PlatformAdminReadError,
  getPlatformUser,
  listPlatformUsers,
  normalizePlatformUser,
  type PlatformAdminUsersDependencies,
  type PlatformAuthUser,
} from "@/lib/platform-admin/users";

function authUser(overrides: Partial<PlatformAuthUser> = {}): PlatformAuthUser {
  return {
    id: "user-1",
    email: "alice@example.com",
    created_at: "2026-09-01T00:00:00.000Z",
    email_confirmed_at: "2026-09-01T00:01:00.000Z",
    last_sign_in_at: "2026-09-09T01:00:00.000Z",
    user_metadata: { full_name: "Alice Example" },
    ...overrides,
  };
}

function dependencies(overrides: Partial<PlatformAdminUsersDependencies> = {}): PlatformAdminUsersDependencies {
  return {
    authorize: async () => undefined,
    listAuthUsers: async () => [authUser()],
    getAuthUser: async () => authUser(),
    getPlatformRoles: async () => ({ "user-1": "owner" }),
    getProfile: async () => ({ displayName: "Alice Profile" }),
    getMemberships: async () => [{ workspaceId: "workspace-1", role: "owner", joinedAt: "2026-09-01T00:00:00.000Z" }],
    getWorkspaces: async () => [{ id: "workspace-1", name: "Alice Workspace", slug: "alice-workspace" }],
    ...overrides,
  };
}

describe("platform admin user read model", () => {
  it("normalizes auth users without exposing arbitrary user metadata", () => {
    const normalized = normalizePlatformUser(
      authUser({ user_metadata: { full_name: "Alice Example", secret_note: "never expose" } }),
      "admin",
      new Date("2026-09-10T00:00:00.000Z"),
    );

    expect(normalized).toEqual({
      id: "user-1",
      email: "alice@example.com",
      displayName: "Alice Example",
      createdAt: "2026-09-01T00:00:00.000Z",
      lastSignInAt: "2026-09-09T01:00:00.000Z",
      confirmedAt: "2026-09-01T00:01:00.000Z",
      status: "active",
      platformRole: "admin",
    });
    expect(normalized).not.toHaveProperty("user_metadata");
  });

  it("marks a future auth ban as suspended", () => {
    const normalized = normalizePlatformUser(
      authUser({ banned_until: "2026-10-01T00:00:00.000Z" }),
      null,
      new Date("2026-09-10T00:00:00.000Z"),
    );
    expect(normalized.status).toBe("suspended");
  });

  it("bounds pagination and performs a bounded normalized search", async () => {
    const seen: Array<[number, number]> = [];
    const deps = dependencies({
      listAuthUsers: async (page, perPage) => {
        seen.push([page, perPage]);
        return [
          authUser(),
          authUser({ id: "user-2", email: "bob@example.com", user_metadata: { full_name: "Bob Builder" } }),
          authUser({ id: "user-3", email: "carol@example.com", user_metadata: {} }),
        ];
      },
      getPlatformRoles: async () => ({ "user-1": "owner" }),
    });

    const result = await listPlatformUsers({ page: 1, perPage: 500, query: "  BOB  " }, deps);

    expect(seen).toEqual([[1, 100]]);
    expect(result.perPage).toBe(100);
    expect(result.users.map((user) => user.id)).toEqual(["user-2"]);
    expect(result.searchTruncated).toBe(false);
  });

  it("returns a normalized detail view with workspace membership", async () => {
    const result = await getPlatformUser("user-1", dependencies());

    expect(result.user.displayName).toBe("Alice Profile");
    expect(result.user.platformRole).toBe("owner");
    expect(result.workspaces).toEqual([
      {
        id: "workspace-1",
        name: "Alice Workspace",
        slug: "alice-workspace",
        role: "owner",
        joinedAt: "2026-09-01T00:00:00.000Z",
      },
    ]);
  });

  it("does not expose provider error bodies through the public read error", async () => {
    await expect(
      listPlatformUsers({}, dependencies({ listAuthUsers: async () => { throw new Error("provider-secret-body"); } })),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PlatformAdminReadError>>({
        code: "PLATFORM_ADMIN_READ_FAILED",
        message: "Unable to load platform user data.",
      }),
    );
  });
});
