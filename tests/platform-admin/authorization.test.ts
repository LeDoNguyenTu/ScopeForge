import { describe, expect, it } from "vitest";
import {
  assertCanModeratePlatformUser,
  assertPlatformAdminRole,
  PlatformAdminAuthorizationError,
} from "@/lib/platform-admin/authorization";

describe("platform admin authorization", () => {
  it.each(["owner", "admin"] as const)("accepts platform %s", (role) => {
    expect(() => assertPlatformAdminRole(role)).not.toThrow();
  });

  it("rejects missing or tenant-only roles", () => {
    expect(() => assertPlatformAdminRole(null)).toThrow(PlatformAdminAuthorizationError);
    expect(() => assertPlatformAdminRole("member" as never)).toThrow(PlatformAdminAuthorizationError);
    expect(() => assertPlatformAdminRole("viewer" as never)).toThrow(PlatformAdminAuthorizationError);
  });

  it("blocks self suspension and deletion", () => {
    for (const operation of ["suspend", "delete"] as const) {
      expect(() => assertCanModeratePlatformUser({
        actorUserId: "11111111-1111-4111-8111-111111111111",
        actorRole: "owner",
        targetUserId: "11111111-1111-4111-8111-111111111111",
        targetPlatformRole: null,
        operation,
      })).toThrowError(expect.objectContaining({ code: "PLATFORM_ADMIN_SELF_ACTION_DENIED" }));
    }
  });

  it("protects every platform administrator from routine user moderation", () => {
    for (const targetPlatformRole of ["owner", "admin"] as const) {
      expect(() => assertCanModeratePlatformUser({
        actorUserId: "11111111-1111-4111-8111-111111111111",
        actorRole: "owner",
        targetUserId: "22222222-2222-4222-8222-222222222222",
        targetPlatformRole,
        operation: "suspend",
      })).toThrowError(expect.objectContaining({ code: "PLATFORM_ADMIN_TARGET_PROTECTED" }));
    }
  });

  it("allows a platform admin to moderate an ordinary different user", () => {
    expect(() => assertCanModeratePlatformUser({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      actorRole: "admin",
      targetUserId: "22222222-2222-4222-8222-222222222222",
      targetPlatformRole: null,
      operation: "suspend",
    })).not.toThrow();
  });
});
