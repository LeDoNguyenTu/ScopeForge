import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import {
  publishRuntimeWorkerTerminal,
  type RuntimeWorkerPublicationDependencies,
} from "@/lib/runtime-workers/publication";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";

type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

const workerId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const domainJobId = "44444444-4444-4444-8444-444444444444";
const workspaceId = "55555555-5555-4555-8555-555555555555";
const assetId = "66666666-6666-4666-8666-666666666666";
const actorId = "77777777-7777-4777-8777-777777777777";
const leaseToken = "a".repeat(64);
const observedAt = new Date("2026-08-31T01:00:00.000Z");

const passiveJob: ScanJobRow = {
  id: domainJobId,
  workspace_id: workspaceId,
  asset_id: assetId,
  job_kind: "passive_runtime",
  status: "running",
  requested_by: actorId,
  blocked_reason: null,
  authorization_canonical_target: "https://example.com",
  authorization_asset_kind: "web_application",
  authorization_verified_at: "2026-08-31T00:00:00.000Z",
  validation_profile_id: null,
  validation_profile_version: null,
  authorization_granted_at: null,
  budget: { ...RUNTIME_OBSERVATION_MAX_BUDGET },
  cancel_requested_at: null,
  started_at: "2026-08-31T00:59:50.000Z",
  finished_at: null,
  failure_code: null,
  request_count: 0,
  redirect_count: 0,
  finding_count: 0,
  created_at: "2026-08-31T00:59:45.000Z",
};

const terminal = {
  schemaVersion: 1 as const,
  taskId,
  attemptId,
  executionClass: "passive_runtime_observation_v1" as const,
  outcome: "succeeded" as const,
  failureCode: null,
  metrics: { wallTimeMs: 10, cpuTimeMs: 0, peakMemoryBytes: 0, inputBytes: 0, outputBytes: 256 },
  result: {
    kind: "passive_runtime_observation" as const,
    requestCount: 1,
    redirectCount: 0,
    observations: [
      { kind: "header" as const, name: "strict-transport-security", present: false as const },
    ],
  },
};

describe("Phase 6D atomic trusted publication", () => {
  it("publishes a successful passive result through one atomic dependency", async () => {
    const atomic = vi.fn(async () => ({ outcome: "succeeded" as const, replayed: false }));
    const legacyPersist = vi.fn(async () => {
      throw new Error("legacy persistence path used");
    });
    const separateFinalize = vi.fn(async () => {
      throw new Error("separate finalization path used");
    });

    const dependencies = {
      getContext: vi.fn(async () => ({
        taskId,
        attemptId,
        executionClass: "passive_runtime_observation_v1" as const,
        domainJobId,
        workspaceId,
        assetId,
        cancelRequested: false,
        leaseExpiresAt: "2026-08-31T01:00:30.000Z",
        finishedAt: null,
        priorOutcome: null,
        priorTerminalDigest: null,
      })),
      loadPassiveJob: vi.fn(async () => passiveJob),
      loadActiveJob: vi.fn(async () => null),
      persistPassive: legacyPersist,
      persistActive: legacyPersist,
      publishPassiveSuccess: atomic,
      publishActiveSuccess: vi.fn(async () => ({ outcome: "succeeded" as const, replayed: false })),
      finalize: separateFinalize,
      now: () => observedAt,
    } as unknown as RuntimeWorkerPublicationDependencies;

    await expect(publishRuntimeWorkerTerminal({
      workerId,
      taskId,
      attemptId,
      leaseToken,
      terminal,
    }, dependencies)).resolves.toEqual({ outcome: "succeeded", replayed: false });

    expect(atomic).toHaveBeenCalledTimes(1);
    expect(atomic).toHaveBeenCalledWith(expect.objectContaining({
      finalization: expect.objectContaining({
        outcome: "succeeded",
        requestCount: 1,
        redirectCount: 0,
      }),
      publication: expect.objectContaining({
        observations: expect.any(Array),
        findings: expect.any(Array),
        evidence: expect.any(Array),
      }),
    }));
    expect(legacyPersist).not.toHaveBeenCalled();
    expect(separateFinalize).not.toHaveBeenCalled();
  });
});
