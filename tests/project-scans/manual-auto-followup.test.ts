import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as projectScanService from "@/lib/project-scans/service";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const LINK_ID = "22222222-2222-4222-8222-222222222222";
const SCAN_TASK_ID = "33333333-3333-4333-8333-333333333333";
const DELIVERY_ID = "44444444-4444-4444-8444-444444444444";
const SNAPSHOT_TASK_ID = "55555555-5555-4555-8555-555555555555";
const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_C = "c".repeat(40);

function terminalContext(overrides: Record<string, unknown> = {}) {
  return {
    matched: true,
    replayed: false,
    followUpRequired: true,
    workspaceId: WORKSPACE_ID,
    linkId: LINK_ID,
    installationId: 42,
    repositoryId: 9001,
    latestDeliveryId: DELIVERY_ID,
    defaultBranch: "main",
    isPrivate: false,
    htmlUrl: "https://github.com/scopeforge-labs/app",
    accessStatus: "active",
    autoScanEnabled: true,
    providerArchived: false,
    desiredCommitSha: SHA_B,
    successfulCommitSha: null,
    ...overrides,
  };
}

function repository(overrides: Record<string, unknown> = {}) {
  return {
    id: 9001,
    ownerLogin: "scopeforge-labs",
    name: "app",
    fullName: "scopeforge-labs/app",
    defaultBranch: "main",
    isPrivate: false,
    isArchived: false,
    htmlUrl: "https://github.com/scopeforge-labs/app",
    ...overrides,
  };
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    settleManualProjectScanTerminal: vi.fn(async () => terminalContext()),
    getConfig: vi.fn(() => ({
      appId: "123",
      clientId: "client-id",
      clientSecret: "client-secret-012345678901234567890123456789",
      privateKey: "private-key-material-012345678901234567890123456789",
      slug: "scopeforge",
      stateSecret: "state-secret-012345678901234567890123456789",
      webhookSecret: "webhook-secret-0123456789012345678901234567",
    })),
    createInstallationToken: vi.fn(async () => ({
      token: "installation-token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })),
    getInstallationRepository: vi.fn(async () => repository()),
    getDefaultBranchHead: vi.fn(async () => SHA_B),
    recordPushHead: vi.fn(async (input: { commitSha: string }) => ({
      replayed: false,
      shouldEnqueue: true,
      ignored: false,
      desiredCommitSha: input.commitSha,
    })),
    enqueueProjectSnapshot: vi.fn(async (input: { commitSha: string }) => ({
      replayed: false,
      taskId: SNAPSHOT_TASK_ID,
      desiredCommitSha: input.commitSha,
    })),
    publicSnapshotRuntimeEnabled: vi.fn(() => true),
    privateSnapshotRuntimeEnabled: vi.fn(() => true),
    ...overrides,
  };
}

function reconciler(): (
  input: { scanTaskId: string },
  dependencies?: unknown,
) => Promise<unknown> {
  const candidate = (projectScanService as Record<string, unknown>)
    .reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal;
  if (typeof candidate !== "function") {
    throw new Error("manual terminal automatic-follow-up reconciler is missing");
  }
  return candidate as (
    input: { scanTaskId: string },
    dependencies?: unknown,
  ) => Promise<unknown>;
}

describe("manual connected-project terminal reconciliation", () => {
  it("ignores non-terminal/retry and already-settled task bindings without provider work", async () => {
    const deps = dependencies({
      settleManualProjectScanTerminal: vi.fn(async () => ({ matched: false, replayed: true })),
    });

    await expect(reconciler()({ scanTaskId: SCAN_TASK_ID }, deps))
      .resolves.toEqual({ status: "ignored" });
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("settles a manual terminal and queues exactly one pending automatic desired head", async () => {
    const deps = dependencies();

    await expect(reconciler()({ scanTaskId: SCAN_TASK_ID }, deps))
      .resolves.toEqual({ status: "follow_up_queued", taskId: SNAPSHOT_TASK_ID, commitSha: SHA_B });
    expect(deps.settleManualProjectScanTerminal).toHaveBeenCalledWith({ scanTaskId: SCAN_TASK_ID });
    expect(deps.enqueueProjectSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.enqueueProjectSnapshot).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      linkId: LINK_ID,
      deliveryId: DELIVERY_ID,
      commitSha: SHA_B,
    });
  });

  it("refreshes a newer authoritative provider head before the single follow-up enqueue", async () => {
    const deps = dependencies({ getDefaultBranchHead: vi.fn(async () => SHA_C) });

    await expect(reconciler()({ scanTaskId: SCAN_TASK_ID }, deps))
      .resolves.toEqual({ status: "follow_up_queued", taskId: SNAPSHOT_TASK_ID, commitSha: SHA_C });
    expect(deps.recordPushHead).toHaveBeenCalledTimes(1);
    expect(deps.recordPushHead).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      linkId: LINK_ID,
      repositoryId: 9001,
      deliveryId: DELIVERY_ID,
      commitSha: SHA_C,
    });
    expect(deps.enqueueProjectSnapshot).toHaveBeenCalledTimes(1);
  });

  it("does not enqueue when the manual scan already satisfied the pending desired head", async () => {
    const deps = dependencies({
      settleManualProjectScanTerminal: vi.fn(async () => ({
        matched: true,
        replayed: false,
        followUpRequired: false,
      })),
    });

    await expect(reconciler()({ scanTaskId: SCAN_TASK_ID }, deps))
      .resolves.toEqual({ status: "ignored" });
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("preserves public/private runtime gates after a manual scan releases the link", async () => {
    const publicDeps = dependencies({ publicSnapshotRuntimeEnabled: vi.fn(() => false) });
    await expect(reconciler()({ scanTaskId: SCAN_TASK_ID }, publicDeps))
      .resolves.toEqual({ status: "runtime_unavailable", code: "PUBLIC_SNAPSHOT_RUNTIME_UNAVAILABLE" });
    expect(publicDeps.enqueueProjectSnapshot).not.toHaveBeenCalled();

    const privateDeps = dependencies({
      settleManualProjectScanTerminal: vi.fn(async () => terminalContext({
        isPrivate: true,
        htmlUrl: "https://github.com/scopeforge-labs/private-app",
      })),
      getInstallationRepository: vi.fn(async () => repository({
        name: "private-app",
        fullName: "scopeforge-labs/private-app",
        isPrivate: true,
        htmlUrl: "https://github.com/scopeforge-labs/private-app",
      })),
      privateSnapshotRuntimeEnabled: vi.fn(() => false),
    });
    await expect(reconciler()({ scanTaskId: SCAN_TASK_ID }, privateDeps))
      .resolves.toEqual({ status: "runtime_unavailable", code: "PRIVATE_SNAPSHOT_RUNTIME_UNAVAILABLE" });
    expect(privateDeps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });
});

describe("manual terminal persistence and route integration", () => {
  it("settles only an exact terminal manual scan task and preserves retries", async () => {
    const sql = await readFile(
      path.resolve("supabase/migrations/20260912023000_phase_10a3_manual_scan_auto_followup.sql"),
      "utf8",
    );
    const normalized = sql.replace(/\s+/g, " ");
    const start = normalized.indexOf("create or replace function public.settle_manual_connected_project_scan_terminal");
    const segment = normalized.slice(start);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(segment).toContain("target_scan_task_id uuid");
    expect(segment).toMatch(/from private\.github_project_scan_intents[^;]+scan_task_id = target_scan_task_id/);
    expect(segment).toContain("intent_record.trigger_kind <> 'manual'");
    expect(segment).toMatch(/task_record\.state = 'completed'[^;]+job_record\.status = 'succeeded'/);
    expect(segment).toMatch(/task_record\.state = 'cancelled'[^;]+job_record\.status = 'cancelled'/);
    expect(segment).toMatch(/task_record\.state = 'dead_letter'[^;]+job_record\.status = 'failed'/);
    expect(segment).toContain("snapshot_record.resolved_commit_sha = auto_record.desired_commit_sha");
    expect(segment).toContain("successful_commit_sha = snapshot_record.resolved_commit_sha");
    expect(segment).toContain("state = 'idle'");
    expect(segment).toContain("project_scan_state = 'idle'");
    expect(segment).toContain("followUpRequired");
    expect(segment).toContain("latestDeliveryId");
    expect(segment).toMatch(/revoke all on function public\.settle_manual_connected_project_scan_terminal\(uuid\)[^;]+service_role/);
    expect(segment).toMatch(/grant execute on function public\.settle_manual_connected_project_scan_terminal\(uuid\) to service_role/);
  });

  it("hooks successful repository-scan publication by exact returned task id", async () => {
    const source = await readFile(
      path.resolve("app/api/internal/workers/repository-scans/finalize/route.ts"),
      "utf8",
    );
    expect(source).toContain("reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal");
    expect(source).toMatch(/publishRepositoryScanSuccess[\s\S]+reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal/);
    expect(source).toContain("scanTaskId: result.taskId");
  });

  it("hooks failed/cancelled repository-scan finalization while letting persistence distinguish retry_wait", async () => {
    const source = await readFile(path.resolve("app/api/internal/workers/finalize/route.ts"), "utf8");
    expect(source).toContain("reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal");
    expect(source).toContain('executionClass === "phase3_repository_scan_no_egress_v1"');
    expect(source).toMatch(/finalizeWorkerAttempt[\s\S]+reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal/);
    expect(source).toContain("scanTaskId: result.taskId");
  });
});
