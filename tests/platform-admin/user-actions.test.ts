import { describe, expect, it } from "vitest";
import {
  PlatformAdminUserActionError,
  hardDeletePlatformUser,
  restorePlatformUser,
  suspendPlatformUser,
  type PlatformAdminUserActionDependencies,
} from "@/lib/platform-admin/user-actions";

const TARGET_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";

function dependencies(overrides: Partial<PlatformAdminUserActionDependencies> = {}): PlatformAdminUserActionDependencies {
  return {
    authorize: async () => ({ actorUserId: ACTOR_ID, actorRole: "owner" }),
    getUser: async () => ({ id: TARGET_ID, email: "target@example.com" }),
    getPlatformRole: async () => null,
    updateAuthUser: async () => undefined,
    deleteAuthUser: async () => undefined,
    listOwnedWorkspaces: async () => [],
    countWorkspaceMembers: async () => 1,
    deleteWorkspace: async () => undefined,
    writeAuditEvent: async () => undefined,
    ...overrides,
  };
}

describe("platform admin guarded user actions", () => {
  it("suspends an ordinary user with the reviewed finite ban duration", async () => {
    const updates: Array<{ userId: string; banDuration: string }> = [];
    await suspendPlatformUser(
      { userId: TARGET_ID, reason: "Abusive automated scanning" },
      dependencies({
        updateAuthUser: async (userId, attributes) => {
          updates.push({ userId, banDuration: attributes.ban_duration });
        },
      }),
    );

    expect(updates).toEqual([{ userId: TARGET_ID, banDuration: "876000h" }]);
  });

  it("restores a suspended user with the supported none ban duration", async () => {
    const updates: string[] = [];
    await restorePlatformUser(
      { userId: TARGET_ID, reason: "Appeal approved" },
      dependencies({ updateAuthUser: async (_userId, attributes) => { updates.push(attributes.ban_duration); } }),
    );

    expect(updates).toEqual(["none"]);
  });

  it("refuses hard deletion when exact fresh email confirmation does not match", async () => {
    await expect(
      hardDeletePlatformUser(
        { userId: TARGET_ID, emailConfirmation: "other@example.com", reason: "Requested deletion" },
        dependencies(),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PlatformAdminUserActionError>>({ code: "USER_DELETE_CONFIRMATION_MISMATCH" }),
    );
  });

  it("refuses hard deletion when the target owns a shared workspace", async () => {
    let authDeleted = false;
    await expect(
      hardDeletePlatformUser(
        { userId: TARGET_ID, emailConfirmation: "target@example.com", reason: "Requested deletion" },
        dependencies({
          listOwnedWorkspaces: async () => [{ id: "workspace-shared", name: "Shared" }],
          countWorkspaceMembers: async () => 2,
          deleteAuthUser: async () => { authDeleted = true; },
        }),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PlatformAdminUserActionError>>({ code: "USER_OWNS_SHARED_WORKSPACE" }),
    );
    expect(authDeleted).toBe(false);
  });

  it("deletes personal workspaces before deleting the Auth user", async () => {
    const order: string[] = [];
    await hardDeletePlatformUser(
      { userId: TARGET_ID, emailConfirmation: "target@example.com", reason: "Requested deletion" },
      dependencies({
        listOwnedWorkspaces: async () => [
          { id: "workspace-1", name: "Personal one" },
          { id: "workspace-2", name: "Personal two" },
        ],
        deleteWorkspace: async (workspaceId) => { order.push(`workspace:${workspaceId}`); },
        deleteAuthUser: async (userId) => { order.push(`auth:${userId}`); },
      }),
    );

    expect(order).toEqual([
      "workspace:workspace-1",
      "workspace:workspace-2",
      `auth:${TARGET_ID}`,
    ]);
  });

  it("protects current and platform administrator accounts through the shared authorization boundary", async () => {
    await expect(
      suspendPlatformUser(
        { userId: ACTOR_ID, reason: "test" },
        dependencies({ getUser: async () => ({ id: ACTOR_ID, email: "actor@example.com" }) }),
      ),
    ).rejects.toEqual(expect.objectContaining({ code: "PLATFORM_ADMIN_SELF_ACTION_DENIED" }));

    await expect(
      suspendPlatformUser(
        { userId: TARGET_ID, reason: "test" },
        dependencies({ getPlatformRole: async () => "admin" }),
      ),
    ).rejects.toEqual(expect.objectContaining({ code: "PLATFORM_ADMIN_TARGET_PROTECTED" }));
  });

  it("bounds reasons and sanitizes provider failures", async () => {
    await expect(
      suspendPlatformUser({ userId: TARGET_ID, reason: "x".repeat(501) }, dependencies()),
    ).rejects.toEqual(expect.objectContaining({ code: "INVALID_ADMIN_REASON" }));

    await expect(
      suspendPlatformUser(
        { userId: TARGET_ID, reason: "policy violation" },
        dependencies({ updateAuthUser: async () => { throw new Error("provider-secret-body"); } }),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PlatformAdminUserActionError>>({
        code: "PLATFORM_ADMIN_USER_ACTION_FAILED",
        message: "The platform user action could not be completed safely.",
      }),
    );
  });
});
