import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { reconcileAutomaticProjectScanAfterSnapshot } from "@/lib/project-scans/service";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const LINK_ID = "22222222-2222-4222-8222-222222222222";
const SNAPSHOT_TASK_ID = "33333333-3333-4333-8333-333333333333";
const SNAPSHOT_ID = "44444444-4444-4444-8444-444444444444";
const DELIVERY_ID = "55555555-5555-4555-8555-555555555555";
const TASK_ID = "66666666-6666-4666-8666-666666666666";
const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_C = "c".repeat(40);

function completion(overrides: Record<string, unknown> = {}) {
  return {
    matched: true,
    replayed: false,
    followUpRequired: false,
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
    desiredCommitSha: SHA_A,
    successfulCommitSha: SHA_A,
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
    completeAutomaticProjectScan: vi.fn(async () => completion()),
    getConfig: vi.fn(() => ({
      appId: "123",
      clientId: "client",
      clientSecret: "client-secret-012345678901234567890123456789",
      privateKey: "private-key",
      slug: "scopeforge",
      stateSecret: "state-secret-012345678901234567890123456789",
      webhookSecret: "webhook-secret-0123456789012345678901234567",
    })),
    createInstallationToken: vi.fn(async () => ({ token: "installation-token", expiresAt: new Date(Date.now() + 60_000).toISOString() })),
    getInstallationRepository: vi.fn(async () => repository()),
    getDefaultBranchHead: vi.fn(async () => SHA_A),
    recordPushHead: vi.fn(async (input: { commitSha: string }) => ({
      replayed: false,
      shouldEnqueue: true,
      coalesced: false,
      ignored: false,
      desiredCommitSha: input.commitSha,
    })),
    enqueueProjectSnapshot: vi.fn(async (input: { commitSha: string }) => ({
      replayed: false,
      taskId: TASK_ID,
      executionClass: "repository_snapshot_github_public_v1" as const,
      desiredCommitSha: input.commitSha,
    })),
    publicSnapshotRuntimeEnabled: vi.fn(() => true),
    privateSnapshotRuntimeEnabled: vi.fn(() => true),
    ...overrides,
  };
}

describe("automatic connected-project completion reconciliation", () => {
  it("ignores manual/non-automatic snapshot intents", async () => {
    const deps = dependencies({ completeAutomaticProjectScan: vi.fn(async () => null) });
    await expect(reconcileAutomaticProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps as never))
      .resolves.toEqual({ status: "ignored" });
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("accepts the immutable resolved snapshot SHA as the successful watermark and stops when it equals desired", async () => {
    const deps = dependencies();
    await expect(reconcileAutomaticProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps as never))
      .resolves.toEqual({ status: "completed", successfulCommitSha: SHA_A });
    expect(deps.completeAutomaticProjectScan).toHaveBeenCalledWith({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID });
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("queues exactly one follow-up when desired advanced while the earlier snapshot was active", async () => {
    const deps = dependencies({
      completeAutomaticProjectScan: vi.fn(async () => completion({
        followUpRequired: true,
        desiredCommitSha: SHA_B,
        successfulCommitSha: SHA_A,
      })),
      getDefaultBranchHead: vi.fn(async () => SHA_B),
    });

    await expect(reconcileAutomaticProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps as never))
      .resolves.toEqual({ status: "follow_up_queued", taskId: TASK_ID, commitSha: SHA_B });
    expect(deps.recordPushHead).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.enqueueProjectSnapshot).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      linkId: LINK_ID,
      deliveryId: DELIVERY_ID,
      commitSha: SHA_B,
    });
  });

  it("refreshes C to a newer authoritative D-equivalent head before the single follow-up enqueue", async () => {
    const deps = dependencies({
      completeAutomaticProjectScan: vi.fn(async () => completion({
        followUpRequired: true,
        desiredCommitSha: SHA_B,
        successfulCommitSha: SHA_A,
      })),
      getDefaultBranchHead: vi.fn(async () => SHA_C),
    });

    await expect(reconcileAutomaticProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps as never))
      .resolves.toEqual({ status: "follow_up_queued", taskId: TASK_ID, commitSha: SHA_C });
    expect(deps.recordPushHead).toHaveBeenCalledTimes(1);
    expect(deps.recordPushHead).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      linkId: LINK_ID,
      repositoryId: 9001,
      deliveryId: DELIVERY_ID,
      commitSha: SHA_C,
    });
    expect(deps.enqueueProjectSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.enqueueProjectSnapshot).toHaveBeenCalledWith(expect.objectContaining({ commitSha: SHA_C }));
  });

  it("is idempotent when replayed completion no longer owns the automatic intent", async () => {
    const deps = dependencies({ completeAutomaticProjectScan: vi.fn(async () => ({ matched: false, replayed: true })) });
    await expect(reconcileAutomaticProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps as never))
      .resolves.toEqual({ status: "ignored" });
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("does not create a follow-up when provider/link eligibility has been revoked", async () => {
    for (const state of [
      { accessStatus: "inaccessible" },
      { autoScanEnabled: false },
      { providerArchived: true },
    ]) {
      const deps = dependencies({
        completeAutomaticProjectScan: vi.fn(async () => completion({
          followUpRequired: true,
          desiredCommitSha: SHA_B,
          successfulCommitSha: SHA_A,
          ...state,
        })),
      });
      await expect(reconcileAutomaticProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps as never))
        .resolves.toEqual({ status: "pending", code: "INELIGIBLE" });
      expect(deps.createInstallationToken).not.toHaveBeenCalled();
      expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
    }
  });

  it("respects public/private snapshot runtime gates for follow-ups", async () => {
    const publicDeps = dependencies({
      completeAutomaticProjectScan: vi.fn(async () => completion({ followUpRequired: true, desiredCommitSha: SHA_B, successfulCommitSha: SHA_A })),
      publicSnapshotRuntimeEnabled: vi.fn(() => false),
    });
    await expect(reconcileAutomaticProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, publicDeps as never))
      .resolves.toEqual({ status: "runtime_unavailable", code: "PUBLIC_SNAPSHOT_RUNTIME_UNAVAILABLE" });
    expect(publicDeps.enqueueProjectSnapshot).not.toHaveBeenCalled();

    const privateDeps = dependencies({
      completeAutomaticProjectScan: vi.fn(async () => completion({
        followUpRequired: true,
        desiredCommitSha: SHA_B,
        successfulCommitSha: SHA_A,
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
    await expect(reconcileAutomaticProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, privateDeps as never))
      .resolves.toEqual({ status: "runtime_unavailable", code: "PRIVATE_SNAPSHOT_RUNTIME_UNAVAILABLE" });
    expect(privateDeps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("fails closed on authoritative repository identity or visibility drift", async () => {
    const deps = dependencies({
      completeAutomaticProjectScan: vi.fn(async () => completion({ followUpRequired: true, desiredCommitSha: SHA_B, successfulCommitSha: SHA_A })),
      getInstallationRepository: vi.fn(async () => repository({ id: 9999 })),
    });
    await expect(reconcileAutomaticProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps as never))
      .resolves.toEqual({ status: "pending", code: "PROVIDER_STATE_CHANGED" });
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });
});

describe("Task 6 persistence and worker-finalize integration", () => {
  it("binds completion to the exact webhook intent and immutable snapshot resolved SHA", async () => {
    const sql = await readFile(path.resolve("supabase/migrations/20260912020000_phase_10a3_github_webhook_reconciliation.sql"), "utf8");
    const normalized = sql.replace(/\s+/g, " ");
    const start = normalized.indexOf("create or replace function public.complete_github_webhook_project_scan");
    const segment = normalized.slice(start);
    expect(segment).toContain("target_snapshot_task_id uuid");
    expect(segment).toContain("target_snapshot_id uuid");
    expect(segment).toMatch(/from private\.github_project_scan_intents[^;]+snapshot_task_id = target_snapshot_task_id[^;]+for update/);
    expect(segment).toMatch(/from public\.repository_source_snapshots[^;]+id = target_snapshot_id/);
    expect(segment).toContain("snapshot_record.resolved_commit_sha");
    expect(segment).toContain("intent_record.trigger_kind <> 'github_webhook'");
    expect(segment).toContain("intent_record.trigger_commit_sha");
    expect(segment).toContain("successful_commit_sha = snapshot_record.resolved_commit_sha");
    expect(segment).toContain("latestDeliveryId");
  });

  it("runs automatic reconciliation only after successful exact-snapshot scan continuation", async () => {
    const source = await readFile(path.resolve("app/api/internal/workers/finalize/route.ts"), "utf8");
    expect(source).toContain("reconcileAutomaticProjectScanAfterSnapshot");
    expect(source).toContain("continuation.status === \"scan_queued\"");
    expect(source).toMatch(/continueConnectedProjectScanAfterSnapshot[\s\S]+reconcileAutomaticProjectScanAfterSnapshot/);
  });
});
