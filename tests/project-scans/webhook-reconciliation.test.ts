import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  automaticProjectScanReconciliationRequiresRetry,
  reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal,
} from "@/lib/project-scans/service";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const LINK_ID = "22222222-2222-4222-8222-222222222222";
const DELIVERY_ID = "55555555-5555-4555-8555-555555555555";
const TASK_ID = "66666666-6666-4666-8666-666666666666";
const SCAN_TASK_ID = "77777777-7777-4777-8777-777777777777";
const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_C = "c".repeat(40);

function completion(overrides: Record<string, unknown> = {}) {
  return {
    matched: true,
    replayed: false,
    followUpRequired: false,
    terminalSucceeded: true,
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
    settleAutomaticProjectScanTerminal: vi.fn(async () => completion()),
    settleManualProjectScanTerminal: vi.fn(async () => ({ matched: false, replayed: true })),
    recoverPendingAutomaticProjectScan: vi.fn(async () => ({ matched: false, replayed: true })),
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

describe("automatic connected-project terminal reconciliation", () => {
  it("ignores non-terminal or already-settled automatic scan tasks", async () => {
    const deps = dependencies({ settleAutomaticProjectScanTerminal: vi.fn(async () => null) });
    await expect(reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal({ scanTaskId: SCAN_TASK_ID }, deps as never))
      .resolves.toEqual({ status: "ignored" });
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("advances the successful watermark only after the repository scan succeeds", async () => {
    const deps = dependencies();
    await expect(reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal({ scanTaskId: SCAN_TASK_ID }, deps as never))
      .resolves.toEqual({ status: "completed", successfulCommitSha: SHA_A });
    expect(deps.settleAutomaticProjectScanTerminal).toHaveBeenCalledWith({ scanTaskId: SCAN_TASK_ID });
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("does not advance or immediately requeue a failed repository scan at the same desired head", async () => {
    const deps = dependencies({
      settleAutomaticProjectScanTerminal: vi.fn(async () => completion({
        terminalSucceeded: false,
        successfulCommitSha: null,
      })),
    });

    await expect(reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal({ scanTaskId: SCAN_TASK_ID }, deps as never))
      .resolves.toEqual({ status: "pending", code: "SCAN_FAILED" });
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("queues exactly one follow-up when desired advanced while the earlier snapshot was active", async () => {
    const deps = dependencies({
      settleAutomaticProjectScanTerminal: vi.fn(async () => completion({
        followUpRequired: true,
        desiredCommitSha: SHA_B,
        successfulCommitSha: SHA_A,
      })),
      getDefaultBranchHead: vi.fn(async () => SHA_B),
    });

    await expect(reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal({ scanTaskId: SCAN_TASK_ID }, deps as never))
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
      settleAutomaticProjectScanTerminal: vi.fn(async () => completion({
        followUpRequired: true,
        desiredCommitSha: SHA_B,
        successfulCommitSha: SHA_A,
      })),
      getDefaultBranchHead: vi.fn(async () => SHA_C),
    });

    await expect(reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal({ scanTaskId: SCAN_TASK_ID }, deps as never))
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
    const deps = dependencies({ settleAutomaticProjectScanTerminal: vi.fn(async () => ({ matched: false, replayed: true })) });
    await expect(reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal({ scanTaskId: SCAN_TASK_ID }, deps as never))
      .resolves.toEqual({ status: "ignored" });
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("recovers a pending desired head after terminal settlement already released the original intent", async () => {
    const deps = dependencies({
      settleAutomaticProjectScanTerminal: vi.fn(async () => ({ matched: false, replayed: true })),
      settleManualProjectScanTerminal: vi.fn(async () => ({ matched: false, replayed: true })),
      recoverPendingAutomaticProjectScan: vi.fn(async () => completion({
        followUpRequired: true,
        desiredCommitSha: SHA_B,
        successfulCommitSha: SHA_A,
      })),
      getDefaultBranchHead: vi.fn(async () => SHA_B),
    });

    await expect(reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal({ scanTaskId: SCAN_TASK_ID }, deps as never))
      .resolves.toEqual({ status: "follow_up_queued", taskId: TASK_ID, commitSha: SHA_B });
    expect(deps.recoverPendingAutomaticProjectScan).toHaveBeenCalledWith({ scanTaskId: SCAN_TASK_ID });
    expect(deps.enqueueProjectSnapshot).toHaveBeenCalledTimes(1);
  });

  it("requires worker retry for transient provider, enqueue, and runtime failures", () => {
    expect(automaticProjectScanReconciliationRequiresRetry({ status: "pending", code: "PROVIDER_UNAVAILABLE" })).toBe(true);
    expect(automaticProjectScanReconciliationRequiresRetry({ status: "pending", code: "ENQUEUE_DEFERRED" })).toBe(true);
    expect(automaticProjectScanReconciliationRequiresRetry({ status: "runtime_unavailable", code: "PUBLIC_SNAPSHOT_RUNTIME_UNAVAILABLE" })).toBe(true);
    expect(automaticProjectScanReconciliationRequiresRetry({ status: "pending", code: "COALESCED" })).toBe(false);
    expect(automaticProjectScanReconciliationRequiresRetry({ status: "pending", code: "SCAN_FAILED" })).toBe(false);
  });

  it("does not create a follow-up when provider/link eligibility has been revoked", async () => {
    for (const state of [
      { accessStatus: "inaccessible" },
      { autoScanEnabled: false },
      { providerArchived: true },
    ]) {
      const deps = dependencies({
        settleAutomaticProjectScanTerminal: vi.fn(async () => completion({
          followUpRequired: true,
          desiredCommitSha: SHA_B,
          successfulCommitSha: SHA_A,
          ...state,
        })),
      });
      await expect(reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal({ scanTaskId: SCAN_TASK_ID }, deps as never))
        .resolves.toEqual({ status: "pending", code: "INELIGIBLE" });
      expect(deps.createInstallationToken).not.toHaveBeenCalled();
      expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
    }
  });

  it("respects public/private snapshot runtime gates for follow-ups", async () => {
    const publicDeps = dependencies({
      settleAutomaticProjectScanTerminal: vi.fn(async () => completion({ followUpRequired: true, desiredCommitSha: SHA_B, successfulCommitSha: SHA_A })),
      publicSnapshotRuntimeEnabled: vi.fn(() => false),
    });
    await expect(reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal({ scanTaskId: SCAN_TASK_ID }, publicDeps as never))
      .resolves.toEqual({ status: "runtime_unavailable", code: "PUBLIC_SNAPSHOT_RUNTIME_UNAVAILABLE" });
    expect(publicDeps.enqueueProjectSnapshot).not.toHaveBeenCalled();

    const privateDeps = dependencies({
      settleAutomaticProjectScanTerminal: vi.fn(async () => completion({
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
    await expect(reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal({ scanTaskId: SCAN_TASK_ID }, privateDeps as never))
      .resolves.toEqual({ status: "runtime_unavailable", code: "PRIVATE_SNAPSHOT_RUNTIME_UNAVAILABLE" });
    expect(privateDeps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("fails closed on authoritative repository identity or visibility drift", async () => {
    const deps = dependencies({
      settleAutomaticProjectScanTerminal: vi.fn(async () => completion({ followUpRequired: true, desiredCommitSha: SHA_B, successfulCommitSha: SHA_A })),
      getInstallationRepository: vi.fn(async () => repository({ id: 9999 })),
    });
    await expect(reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal({ scanTaskId: SCAN_TASK_ID }, deps as never))
      .resolves.toEqual({ status: "pending", code: "PROVIDER_STATE_CHANGED" });
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });
});

describe("automatic terminal persistence and worker-finalize integration", () => {
  it("binds successful completion to the exact terminal repository scan and immutable snapshot", async () => {
    const sql = await readFile(path.resolve("supabase/migrations/20260915010000_phase_10a3_terminal_scan_watermark.sql"), "utf8");
    const normalized = sql.replace(/\s+/g, " ");
    const start = normalized.indexOf("create or replace function public.settle_github_webhook_project_scan_terminal");
    const segment = normalized.slice(start);
    expect(segment).toContain("target_scan_task_id uuid");
    expect(segment).toMatch(/from private\.github_project_scan_intents[^;]+scan_task_id = target_scan_task_id[^;]+for update/);
    expect(segment).toMatch(/task_record\.state = 'completed'[^;]+job_record\.status = 'succeeded'/);
    expect(segment).toMatch(/task_record\.state = 'dead_letter'[^;]+job_record\.status = 'failed'/);
    expect(segment).toMatch(/from public\.repository_source_snapshots[^;]+id = repository_scan_record\.snapshot_id/);
    expect(segment).toContain("snapshot_record.resolved_commit_sha");
    expect(segment).toContain("intent_record.trigger_kind <> 'github_webhook'");
    expect(segment).toContain("intent_record.trigger_commit_sha is distinct from snapshot_record.resolved_commit_sha");
    expect(segment).toContain("if terminal_succeeded then");
    expect(segment).toContain("successful_commit_sha = snapshot_record.resolved_commit_sha");
    expect(segment).toContain("latestDeliveryId");
    expect(segment).toMatch(/revoke all on function public\.settle_github_webhook_project_scan_terminal\(uuid\)[^;]+service_role/);
    expect(segment).toMatch(/grant execute on function public\.settle_github_webhook_project_scan_terminal\(uuid\) to service_role/);
  });

  it("does not reconcile success while snapshot continuation only queues the repository scan", async () => {
    const snapshotFinalize = await readFile(path.resolve("app/api/internal/workers/finalize/route.ts"), "utf8");
    const repositoryFinalize = await readFile(path.resolve("app/api/internal/workers/repository-scans/finalize/route.ts"), "utf8");
    expect(snapshotFinalize).not.toContain("reconcileAutomaticProjectScanAfterSnapshot");
    expect(repositoryFinalize).toMatch(/publishRepositoryScanSuccess[\s\S]+reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal/);
  });

  it("keeps pending reconciliation retryable after terminal intent release", async () => {
    const sql = await readFile(path.resolve("supabase/migrations/20260915010000_phase_10a3_terminal_scan_watermark.sql"), "utf8");
    const genericFinalize = await readFile(path.resolve("app/api/internal/workers/finalize/route.ts"), "utf8");
    const repositoryFinalize = await readFile(path.resolve("app/api/internal/workers/repository-scans/finalize/route.ts"), "utf8");

    expect(sql).toContain("create or replace function public.recover_pending_github_webhook_project_scan");
    expect(sql.replace(/\s+/g, " ")).toMatch(/grant execute on function public\.recover_pending_github_webhook_project_scan\(uuid\) to service_role/);
    for (const source of [genericFinalize, repositoryFinalize]) {
      expect(source).toContain("automaticProjectScanReconciliationRequiresRetry");
      expect(source).toMatch(/reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal[\s\S]+automaticProjectScanReconciliationRequiresRetry/);
    }
  });
});
