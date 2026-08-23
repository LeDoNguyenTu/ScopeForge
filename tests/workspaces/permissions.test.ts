import { describe, expect, it } from "vitest";
import { assertCanManageAssets, WorkspacePermissionError } from "@/lib/workspaces/permissions";

describe("assertCanManageAssets", () => {
  it.each(["owner", "admin", "member"] as const)("allows %s to manage assets", (role) => {
    expect(() => assertCanManageAssets(role)).not.toThrow();
  });

  it("rejects viewers from security-sensitive asset writes", () => {
    expect(() => assertCanManageAssets("viewer")).toThrow(WorkspacePermissionError);
    try {
      assertCanManageAssets("viewer");
    } catch (error) {
      expect(error).toMatchObject({ code: "INSUFFICIENT_WORKSPACE_ROLE" });
    }
  });
});
