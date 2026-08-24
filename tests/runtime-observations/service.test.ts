import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import type { RuntimeObservationRepository } from "@/lib/runtime-observations/repository";
import {
  enqueueRuntimeObservation,
  executeRuntimeObservation,
  requestRuntimeObservationCancellation,
  type RuntimeObservationAuditEvent,
  type RuntimeObservationServiceDependencies,
} from "@/lib/runtime-observations/service";
import {
  RUNTIME_OBSERVATION_MAX_BUDGET,
  type RuntimeObservationResult,
} from "@/packages/runtime-observer";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

const verifiedAt = "2026-08-24T12:00:00.000Z";
const createdAt = "2026-08-24T11:00:00.000Z";

function asset(overrides: Partial<AssetRow> = {}): AssetRow {
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
    ...overrides,
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

function repository(overrides: Partial<RuntimeObservationRepository> = {}): RuntimeObservationRepository {
  const base = {
    enqueue: vi.fn(async () => job()),
    load: vi.fn(async () => job()),
    loadForWorkspace: vi.fn(async () => job()),
    markRunning: vi.fn(async (input: ScanJobRow) => job({
      ...input,
      status: "running",
      started_at: "2026-08-24T12:01:00.000Z",
    })),
    markBlocked: vi.fn(async (input: ScanJobRow, code: string, reason: string) => job({
      ...input,
      status: "blocked",
      failure_code: code,
      blocked_reason: reason,
      finished_at: "2026-08-24T12:01:00.000Z",
    })),
    markSucceeded: vi.fn(async (input: ScanJobRow, counts: {
      requestCount: number;
      redirectCount: number;
      findingCount: number;
    }) => job({
      ...input,
      status: "succeeded",
      request_count: counts.requestCount,
      redirect_count: counts.redirectCount,
      finding_count: counts.findingCount,
      finished_at: "2026-08-24T12:01:00.000Z",
    })),
    markFailed: vi.fn(async (input: ScanJobRow, failureCode: string) => job({
      ...input,
      status: "failed",
      failure_code: failureCode,
      finished_at: "2026-08-24T12:01:00.000Z",
    })),
    markCancelled: vi.fn(async (input: ScanJobRow) => job({
      ...input,
      status: "cancelled",
      finished_at: "2026-08-24T12:01:00.000Z",
    })),
    requestCancellation: vi.fn(async () => job({
      cancel_requested_at: "2026-08-24T12:01:00.000Z",
    })),
    persistObservations: vi.fn(async () => undefined),
    listObservations: vi.fn(async () => []),
  };

  return { ...base, ...overrides } as unknown as RuntimeObservationRepository;
}

function dependencies(input: {
  repo?: RuntimeObservationRepository;
  selectedAsset?: AssetRow | null;
  observe?: RuntimeObservationServiceDependencies["observe"];
  audit?: RuntimeObservationServiceDependencies["audit"];
} = {}): RuntimeObservationServiceDependencies {
  return {
    repository: input.repo ?? repository(),
    loadAsset: vi.fn(async () => input.selectedAsset === undefined ? asset() : input.selectedAsset),
    observe: input.observe,
    audit: input.audit ?? vi.fn(async () => undefined),
    now: () => new Date("2026-08-24T12:02:00.000Z"),
  };
}

function succeededResult(): RuntimeObservationResult {
  return {
    status: "succeeded",
    observations: [
      {
        kind: "header",
        name: "strict-transport-security",
        present: false,
      },
    ],
    requestCount: 1,
    redirectCount: 0,
  };
}

describe("enqueueRuntimeObservation", () => {
  it("persists the authorization snapshot before writing the enqueue audit event", async () => {
    const order: string[] = [];
    const repo = repository({
      enqueue: vi.fn(async (input) => {
        order.push("enqueue");
        expect(input).toMatchObject({
          workspaceId: "workspace-1",
          assetId: "asset-1",
          requestedBy: "user-1",
          canonicalTarget: "https://example.com",
          assetKind: "web_application",
          verifiedAt,
        });
        return job();
      }),
    });
    const audit = vi.fn(async (event: RuntimeObservationAuditEvent) => {
      order.push("audit");
      expect(event).toEqual({
        workspaceId: "workspace-1",
        actorId: "user-1",
        eventType: "runtime_observation.enqueued",
        jobId: "job-1",
        assetId: "asset-1",
        metadata: { assetKind: "web_application" },
      });
    });

    const result = await enqueueRuntimeObservation({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "member",
      assetId: "asset-1",
      budget: RUNTIME_OBSERVATION_MAX_BUDGET,
    }, dependencies({ repo, audit }));

    expect(result.job.id).toBe("job-1");
    expect(order).toEqual(["enqueue", "audit"]);
  });
});

describe("executeRuntimeObservation", () => {
  it.each([
    ["missing asset", null, job(), "RUNTIME_ASSET_NOT_AVAILABLE"],
    ["workspace mismatch", asset({ workspace_id: "workspace-2" }), job(), "RUNTIME_ASSET_NOT_AVAILABLE"],
    ["unverified asset", asset({ verification_status: "unverified", verified_at: null }), job(), "RUNTIME_ASSET_UNVERIFIED"],
    ["changed verification", asset({ verified_at: "2026-08-24T12:30:00.000Z" }), job(), "RUNTIME_AUTHORIZATION_CHANGED"],
  ])("blocks %s before invoking the observer", async (_label, selectedAsset, queuedJob, expectedCode) => {
    const observe = vi.fn(async () => succeededResult());
    const repo = repository({ load: vi.fn(async () => queuedJob as ScanJobRow) });

    const result = await executeRuntimeObservation(
      "job-1",
      dependencies({ repo, selectedAsset: selectedAsset as AssetRow | null, observe }),
    );

    expect(result.status).toBe("blocked");
    expect(result.failureCode).toBe(expectedCode);
    expect(observe).not.toHaveBeenCalled();
    expect(repo.markRunning).not.toHaveBeenCalled();
    expect(repo.markBlocked).toHaveBeenCalledWith(
      expect.objectContaining({ id: "job-1", status: "queued" }),
      expectedCode,
      expect.any(String),
    );
  });

  it("turns a pre-start cancellation request into the cancelled terminal state without networking", async () => {
    const cancelledJob = job({ cancel_requested_at: "2026-08-24T12:01:00.000Z" });
    const observe = vi.fn(async () => succeededResult());
    const repo = repository({ load: vi.fn(async () => cancelledJob) });

    const result = await executeRuntimeObservation(
      "job-1",
      dependencies({ repo, observe }),
    );

    expect(result.status).toBe("cancelled");
    expect(observe).not.toHaveBeenCalled();
    expect(repo.markRunning).not.toHaveBeenCalled();
    expect(repo.markCancelled).toHaveBeenCalledWith(cancelledJob);
  });

  it("executes an unchanged authorization snapshot and persists only normalized observations and deterministic finding counts", async () => {
    const runningJob = job({
      status: "running",
      started_at: "2026-08-24T12:01:00.000Z",
    });
    const repo = repository({
      load: vi.fn()
        .mockResolvedValueOnce(job())
        .mockResolvedValueOnce(runningJob),
      markRunning: vi.fn(async () => runningJob),
    });
    const observe = vi.fn(async () => succeededResult());

    const result = await executeRuntimeObservation(
      "job-1",
      dependencies({ repo, observe }),
    );

    expect(result.status).toBe("succeeded");
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({
        assetRef: "asset-1",
        canonicalUrl: "https://example.com",
        hostname: "example.com",
      }),
      RUNTIME_OBSERVATION_MAX_BUDGET,
      expect.objectContaining({ now: expect.any(Function) }),
    );
    expect(repo.persistObservations).toHaveBeenCalledWith(
      runningJob,
      succeededResult().observations,
      RUNTIME_OBSERVATION_MAX_BUDGET.maxObservationBytes,
    );
    expect(repo.markSucceeded).toHaveBeenCalledWith(
      runningJob,
      { requestCount: 1, redirectCount: 0, findingCount: 1 },
    );
    expect(result.findings).toHaveLength(1);
    expect(result.evidence).toHaveLength(1);
  });

  it("persists stable observer failure codes without raw exception text", async () => {
    const runningJob = job({ status: "running", started_at: createdAt });
    const repo = repository({ markRunning: vi.fn(async () => runningJob) });
    const audit = vi.fn(async () => undefined);
    const observe = vi.fn(async (): Promise<RuntimeObservationResult> => ({
      status: "failed",
      observations: [],
      requestCount: 1,
      redirectCount: 0,
      failureCode: "NETWORK_ERROR",
    }));

    const result = await executeRuntimeObservation(
      "job-1",
      dependencies({ repo, observe, audit }),
    );

    expect(result).toMatchObject({ status: "failed", failureCode: "NETWORK_ERROR" });
    expect(repo.markFailed).toHaveBeenCalledWith(runningJob, "NETWORK_ERROR");
    expect(JSON.stringify(audit.mock.calls)).not.toContain("headers");
    expect(JSON.stringify(audit.mock.calls)).not.toContain("cookie");
  });

  it("converts unexpected observer exceptions to a stable failure without persisting the exception message", async () => {
    const runningJob = job({ status: "running", started_at: createdAt });
    const repo = repository({ markRunning: vi.fn(async () => runningJob) });
    const audit = vi.fn(async () => undefined);
    const observe = vi.fn(async () => {
      throw new Error("secret upstream response text");
    });

    const result = await executeRuntimeObservation(
      "job-1",
      dependencies({ repo, observe, audit }),
    );

    expect(result).toMatchObject({
      status: "failed",
      failureCode: "RUNTIME_EXECUTION_ERROR",
    });
    expect(repo.markFailed).toHaveBeenCalledWith(runningJob, "RUNTIME_EXECUTION_ERROR");
    expect(JSON.stringify(result)).not.toContain("secret upstream response text");
    expect(JSON.stringify(audit.mock.calls)).not.toContain("secret upstream response text");
  });

  it("honors a cancellation requested while the bounded observer was running before persisting observations", async () => {
    const runningJob = job({ status: "running", started_at: createdAt });
    const cancelledRunningJob = job({
      status: "running",
      started_at: createdAt,
      cancel_requested_at: "2026-08-24T12:01:30.000Z",
    });
    const repo = repository({
      load: vi.fn()
        .mockResolvedValueOnce(job())
        .mockResolvedValueOnce(cancelledRunningJob),
      markRunning: vi.fn(async () => runningJob),
    });

    const result = await executeRuntimeObservation(
      "job-1",
      dependencies({ repo, observe: vi.fn(async () => succeededResult()) }),
    );

    expect(result.status).toBe("cancelled");
    expect(repo.persistObservations).not.toHaveBeenCalled();
    expect(repo.markSucceeded).not.toHaveBeenCalled();
    expect(repo.markCancelled).toHaveBeenCalledWith(cancelledRunningJob);
  });
});

describe("requestRuntimeObservationCancellation", () => {
  it("cancels a queued job immediately", async () => {
    const requested = job({ cancel_requested_at: "2026-08-24T12:01:00.000Z" });
    const cancelled = job({
      status: "cancelled",
      cancel_requested_at: requested.cancel_requested_at,
      finished_at: "2026-08-24T12:01:00.000Z",
    });
    const repo = repository({
      loadForWorkspace: vi.fn(async () => job()),
      requestCancellation: vi.fn(async () => requested),
      markCancelled: vi.fn(async () => cancelled),
    });

    const result = await requestRuntimeObservationCancellation({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "member",
      jobId: "job-1",
    }, dependencies({ repo }));

    expect(result.status).toBe("cancelled");
    expect(result.job.status).toBe("cancelled");
  });

  it("records a cancellation request for a running job without stealing the executor terminal transition", async () => {
    const running = job({ status: "running", started_at: createdAt });
    const requested = job({
      ...running,
      cancel_requested_at: "2026-08-24T12:01:00.000Z",
    });
    const repo = repository({
      loadForWorkspace: vi.fn(async () => running),
      requestCancellation: vi.fn(async () => requested),
    });

    const result = await requestRuntimeObservationCancellation({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "admin",
      jobId: "job-1",
    }, dependencies({ repo }));

    expect(result.status).toBe("cancellation_requested");
    expect(repo.markCancelled).not.toHaveBeenCalled();
  });
});
