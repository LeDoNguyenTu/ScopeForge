import { describe, expect, it } from "vitest";
import { evaluateStopConditions, updateCoverage } from "./coverage";
import type { ActionResult, CoverageState } from "./types";

const NOW = new Date("2026-09-18T00:00:00.000Z");

function coverage(overrides: Partial<CoverageState> = {}): CoverageState {
  return {
    attemptedCapabilityIds: [],
    coveredNodeIds: [],
    untestedNodeIds: ["node-a", "node-b"],
    requestCount: 0,
    graphExpansionCount: 0,
    providerFailureCount: 0,
    startedAt: "2026-09-17T23:55:00.000Z",
    deadlineAt: "2026-09-18T00:10:00.000Z",
    ...overrides,
  };
}

function actionResult(status: ActionResult["status"] = "succeeded"): ActionResult {
  return {
    actionId: "action-1",
    authorizationId: "authz-1",
    providerId: "provider-1",
    providerVersion: "1.0.0",
    status,
    observationIds: [],
    evidenceRefs: [],
    startedAt: "2026-09-17T23:59:00.000Z",
    completedAt: "2026-09-17T23:59:01.000Z",
  };
}

function stopInput(overrides: Partial<Parameters<typeof evaluateStopConditions>[0]> = {}) {
  return {
    coverage: coverage(),
    now: NOW,
    cancelled: false,
    requestBudget: 10,
    graphExpansionLimit: 10,
    providerFailureLimit: 3,
    eligibleHypothesisCount: 1,
    approvalRequired: false,
    authorizationExpiresAt: "2026-09-18T00:05:00.000Z",
    ...overrides,
  };
}

describe("Phase 11 coverage and stop conditions", () => {
  it("updates bounded coverage and provider failure accounting", () => {
    const updated = updateCoverage(coverage(), actionResult("provider_failed"), {
      capabilityId: "web.http.probe.v1",
      nodeIds: ["node-a"],
      requestCount: 2,
      graphExpansionCount: 1,
    });

    expect(updated).toMatchObject({
      attemptedCapabilityIds: ["web.http.probe.v1"],
      coveredNodeIds: ["node-a"],
      untestedNodeIds: ["node-b"],
      requestCount: 2,
      graphExpansionCount: 1,
      providerFailureCount: 1,
    });
  });


  it.each(["blocked", "cancelled", "policy_rejected"] as const)(
    "charges request usage without claiming coverage for %s actions",
    (status) => {
      const updated = updateCoverage(coverage(), actionResult(status), {
        capabilityId: "web.http.probe.v1",
        nodeIds: ["node-a"],
        requestCount: 2,
      });

      expect(updated).toMatchObject({
        attemptedCapabilityIds: [],
        coveredNodeIds: [],
        untestedNodeIds: ["node-a", "node-b"],
        requestCount: 2,
        providerFailureCount: 0,
      });
    },
  );

  it.each([
    ["cancelled", { cancelled: true }],
    ["authorization_expired", { authorizationExpiresAt: "2026-09-17T23:59:59.000Z" }],
    ["deadline_reached", { coverage: coverage({ deadlineAt: "2026-09-17T23:59:59.000Z" }) }],
    ["request_budget_exhausted", { coverage: coverage({ requestCount: 10 }) }],
    ["graph_expansion_limit", { coverage: coverage({ graphExpansionCount: 10 }) }],
    ["provider_failure_limit", { coverage: coverage({ providerFailureCount: 3 }) }],
    ["approval_required", { approvalRequired: true }],
    ["coverage_complete", { coverage: coverage({ untestedNodeIds: [] }) }],
    ["no_eligible_hypotheses", { eligibleHypothesisCount: 0 }],
  ] as const)("returns %s deterministically", (expected, overrides) => {
    expect(evaluateStopConditions(stopInput(overrides as never))).toBe(expected);
  });

  it("continues when no stop condition has been reached", () => {
    expect(evaluateStopConditions(stopInput())).toBeUndefined();
  });
});
