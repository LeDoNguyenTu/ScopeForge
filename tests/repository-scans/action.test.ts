import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actionPath = path.resolve("app/dashboard/assets/[assetId]/scan-actions.ts");

describe("Phase 6C repository scan server action", () => {
  it("accepts only the repository asset ID and derives actor, workspace, role, snapshot, class, profile, and budget server-side", async () => {
    const source = await readFile(actionPath, "utf8");
    expect(source).toMatch(/export async function requestHostedRepositoryScan\(assetId: string\)/);
    expect(source).toContain("createClient");
    expect(source).toContain("supabase.auth.getUser()");
    expect(source).toContain("workspace_members");
    expect(source).toContain('membership.role !== "owner" && membership.role !== "admin"');
    expect(source).toContain("enqueue_repository_scan_worker_task");
    for (const forbidden of [
      "snapshotId: string",
      "executionClass: string",
      "scannerProfileId: string",
      "budget:",
      "workspaceId: string",
      "actorId: string",
      "repositoryUrl: string",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("uses only the service-role RPC after authenticated asset and membership checks", async () => {
    const source = await readFile(actionPath, "utf8");
    const membership = source.indexOf("workspace_members");
    const roleCheck = source.indexOf('membership.role !== "owner" && membership.role !== "admin"');
    const adminInvocation = source.indexOf("const admin = createAdminClient<Phase6cDatabase>()");
    const enqueue = source.indexOf("enqueue_repository_scan_worker_task");
    expect(membership).toBeGreaterThan(-1);
    expect(roleCheck).toBeGreaterThan(membership);
    expect(adminInvocation).toBeGreaterThan(roleCheck);
    expect(enqueue).toBeGreaterThan(adminInvocation);
  });
});
