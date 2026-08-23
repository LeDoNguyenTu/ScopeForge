import type { WorkspaceRole } from "@/lib/database.types";

export class WorkspacePermissionError extends Error {
  readonly code = "INSUFFICIENT_WORKSPACE_ROLE" as const;

  constructor() {
    super("Your workspace role cannot modify security assets.");
    this.name = "WorkspacePermissionError";
  }
}

export function assertCanManageAssets(role: WorkspaceRole): void {
  if (role === "viewer") throw new WorkspacePermissionError();
}
