import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import type { RuntimeObservationRepository } from "@/lib/runtime-observations/repository";
import { executeRuntimeObservation } from "@/lib/runtime-observations/service";
import {
  RUNTIME_OBSERVATION_MAX_BUDGET,
  type RuntimeObserverDependencies,
} from "@/packages/runtime-observer";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

const verifiedAt = "2026-08-24T12:00:00.000Z";
const createdAt = "2026-08-24T11:00:00.000Z";

function asset(): AssetRow {
  return {
    id: "asset-1",
    workspace_id: "workspace-1",
    kind: "web_application",
    name: "Example",
    canonical_target: "https://example.com",
    hostname: "example.com",
    verification_status: "verified",
    verified_at: verifiedAt,
    verified_by: "user-1",
    created_by: "user-1",
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function job(overrides: Partial<ScanJobRow> = {}): ScanJobRow {
  return {
    id: "job-1",
    workspace_id: "workspace-1",
    asset_id: "asset-1",
    job_kind: "passive_runtime",
    status: "queued",
    requested_by: "user-1",
    blocked_reason: null,
    authorization_canonical_target: "https://example.com",
    authorization_asset_kind: "web_application",
    authorization_verified_at: verifiedAt,
    budget: { ...RUNTIME_OBSERVATION_MAX_BUDGET },
    cancel_requested_at: null,
    started_at: null,
    finished_at: null,
    failure_code: null,
    request_count: 0,
    redirect_count: 0,
    finding_count: 0,
    created_at: createdAt,
    ...overrides,
  };
}

describe("runtime observation service async cancellation", () => {
  it("injects a workspace-bound database cancellation check into the observer", async () => {
    const queuedJob = job();
    const runningJob = job({ status: "running", started_at: createdAt });
    const cancellationRequested = job({
      status: "running",
      started_at: createdAt,
      cancel_requested_at: "2026-08-24T12:01:30.000Z",
    });
    const cancelledJob = job({
      ...cancellationRequested,
      status: "cancelled",
      finished_at: "2026-08-24T12:01:31.000Z",
    });

    const load = vi.fn()
      .mockResolvedValueOnce(queuedJob)
      .mockResolvedValueOnce(cancellationRequested);
    const loadForWorkspace = vi.fn(async (jobId: string, workspaceId: string) => {
      expect(jobId).toBe("job-1");
      expect(workspaceId).toBe("workspace-1");
      return cancellationRequested;
    });
    const persistObservations = vi.fn(async () => undefined);
    const markSucceeded = vi.fn(async () => runningJob);
    const markCancelled = vi.fn(async () => cancelledJob);

    const repository = {
      enqueue: vi.fn(),
      load,
      loadForWorkspace,
      markRunning: vi.fn(async () => runningJob),
      markBlocked: vi.fn(),
      markSucceeded,
      markFailed: vi.fn(),
      markCancelled,
      requestCancellation: vi.fn(),
      persistObservations,
      listObservations: vi.fn(),
    } as unknown as RuntimeObservationRepository;

    const observe = vi.fn(async (
      _target: unknown,
      _budget: unknown,
      observerDependencies: RuntimeObserverDependencies = {},
    ) => {
      expect(observerDependencies.isCancelled).toEqual(expect.any(Function));
      const cancelled = await observerDependencies.isCancelled?.();
      return {
        status: cancelled ? "cancelled" as const : "succeeded" as const,
        observations: [],
        requestCount: 1,
        redirectCount: 0,
      };
    });

    const result = await executeRuntimeObservation("job-1", {
      repository,
      loadAsset: vi.fn(async () => asset()),
      observe,
      audit: vi.fn(async () => undefined),
      now: () => new Date("2026-08-24T12:02:00.000Z"),
    });

    expect(result.status).toBe("cancelled");
    expect(loadForWorkspace).toHaveBeenCalledTimes(1);
    expect(persistObservations).not.toHaveBeenCalled();
    expect(markSucceeded).not.toHaveBeenCalled();
    expect(markCancelled).toHaveBeenCalledWith(cancellationRequested);
  });
});
