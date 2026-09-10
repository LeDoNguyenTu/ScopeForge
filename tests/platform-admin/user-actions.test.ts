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
    listWorkspaceMemberUserIds: async () => [TARGET_ID],
    deleteWorkspace: async () => undefined,
    writeAuditEvent: async () => undefined,
    ...overrides,
  };
}

describe("platform admin guarded user actions", () => {
  it("records suspend intent before changing Auth and completion afterward", async () => {
    const order: string[] = [];
    await suspendPlatformUser(
      { userId: TARGET_ID, reason: "Abusive automated scanning" },
      dependencies({
        writeAuditEvent: async (input) => { order.push(`audit:${input.action}`); },
        updateAuthUser: async (userId, attributes) => {
          expect(userId).toBe(TARGET_ID);
          expect(attributes.ban_duration).toBe("876000h");
          order.push("auth:suspended");
        },
      }),
    );

    expect(order).toEqual([
      "audit:user.suspend_started",
      "auth:suspended",
      "audit:user.suspended",
    ]);
  });

  it("records restore intent before changing Auth and completion afterward", async () => {
    const order: string[] = [];
    await restorePlatformUser(
      { userId: TARGET_ID, reason: "Appeal approved" },
      dependencies({
        writeAuditEvent: async (input) => { order.push(`audit:${input.action}`); },
        updateAuthUser: async (_userId, attributes) => {
          expect(attributes.ban_duration).toBe("none");
          order.push("auth:restored");
        },
      }),
    );

    expect(order).toEqual([
      "audit:user.restore_started",
      "auth:restored",
      "audit:user.restored",
    ]);
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
          listWorkspaceMemberUserIds: async () => [TARGET_ID, "33333333-3333-4333-8333-333333333333"],
          deleteAuthUser: async () => { authDeleted = true; },
        }),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PlatformAdminUserActionError>>({ code: "USER_OWNS_SHARED_WORKSPACE" }),
    );
    expect(authDeleted).toBe(false);
  });

  it("refuses hard deletion when an owned workspace has a different sole member", async () => {
    let workspaceDeleted = false;
    let authDeleted = false;
    await expect(
      hardDeletePlatformUser(
        { userId: TARGET_ID, emailConfirmation: "target@example.com", reason: "Requested deletion" },
        dependencies({
          listOwnedWorkspaces: async () => [{ id: "workspace-corrupt", name: "Unexpected membership" }],
          listWorkspaceMemberUserIds: async () => ["33333333-3333-4333-8333-333333333333"],
          deleteWorkspace: async () => { workspaceDeleted = true; },
          deleteAuthUser: async () => { authDeleted = true; },
        }),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PlatformAdminUserActionError>>({ code: "USER_OWNS_SHARED_WORKSPACE" }),
    );
    expect(workspaceDeleted).toBe(false);
    expect(authDeleted).toBe(false);
  });

  it("refuses hard deletion when an owned workspace has no membership row", async () => {
    await expect(
      hardDeletePlatformUser(
        { userId: TARGET_ID, emailConfirmation: "target@example.com", reason: "Requested deletion" },
        dependencies({
          listOwnedWorkspaces: async () => [{ id: "workspace-orphaned", name: "Orphaned" }],
          listWorkspaceMemberUserIds: async () => [],
        }),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PlatformAdminUserActionError>>({ code: "USER_OWNS_SHARED_WORKSPACE" }),
    );
  });

  it("deletes only target-exclusive personal workspaces before deleting the Auth user", async () => {
    const order: string[] = [];
    await hardDeletePlatformUser(
      { userId: TARGET_ID, emailConfirmation: "target@example.com", reason: "Requested deletion" },
      dependencies({
        listOwnedWorkspaces: async () => [
          { id: "workspace-1", name: "Personal one" },
          { id: "workspace-2", name: "Personal two" },
        ],
        listWorkspaceMemberUserIds: async () => [TARGET_ID],
        writeAuditEvent: async (input) => { order.push(`audit:${input.action}`); },
        deleteWorkspace: async (workspaceId) => { order.push(`workspace:${workspaceId}`); },
        deleteAuthUser: async (userId) => { order.push(`auth:${userId}`); },
      }),
    );

    expect(order).toEqual([
      "audit:user.delete_started",
      "workspace:workspace-1",
      "workspace:workspace-2",
      `auth:${TARGET_ID}`,
      "audit:user.deleted",
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

  it("records a suspend attempt before a sanitized provider failure", async () => {
    const auditActions: string[] = [];
    await expect(
      suspendPlatformUser(
        { userId: TARGET_ID, reason: "policy violation" },
        dependencies({
          writeAuditEvent: async (input) => { auditActions.push(input.action); },
          updateAuthUser: async () => { throw new Error("provider-secret-body"); },
        }),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PlatformAdminUserActionError>>({
        code: "PLATFORM_ADMIN_USER_ACTION_FAILED",
        message: "The platform user action could not be completed safely.",
      }),
    );
    expect(auditActions).toEqual(["user.suspend_started"]);
  });

  it("bounds reasons", async () => {
    await expect(
      suspendPlatformUser({ userId: TARGET_ID, reason: "x".repeat(501) }, dependencies()),
    ).rejects.toEqual(expect.objectContaining({ code: "INVALID_ADMIN_REASON" }));
  });
});
