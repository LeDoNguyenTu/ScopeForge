import type { ActionResult, CoverageState, RunStopReason } from "./types";

export interface CoverageUpdate {
  capabilityId: string;
  nodeIds: readonly string[];
  requestCount: number;
  graphExpansionCount?: number;
}

export interface StopConditionInput {
  coverage: CoverageState;
  now: Date;
  cancelled: boolean;
  requestBudget: number;
  graphExpansionLimit: number;
  providerFailureLimit: number;
  eligibleHypothesisCount: number;
  approvalRequired: boolean;
  authorizationExpiresAt?: string;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

export function updateCoverage(
  coverage: CoverageState,
  result: ActionResult,
  update: CoverageUpdate,
): CoverageState {
  if (!update.capabilityId.trim() || update.nodeIds.some((nodeId) => !nodeId.trim())) {
    throw new Error("COVERAGE_UPDATE_INVALID");
  }
  if (!Number.isInteger(update.requestCount) || update.requestCount < 0) {
    throw new Error("COVERAGE_REQUEST_COUNT_INVALID");
  }
  const graphExpansionCount = update.graphExpansionCount ?? 0;
  if (!Number.isInteger(graphExpansionCount) || graphExpansionCount < 0) {
    throw new Error("COVERAGE_GRAPH_EXPANSION_INVALID");
  }

  const countsAsAttempt = result.status === "succeeded"
    || result.status === "no_signal"
    || result.status === "timed_out"
    || result.status === "provider_failed";
  const countsAsCoverage = result.status === "succeeded" || result.status === "no_signal";
  const coveredNodeIds = countsAsCoverage
    ? uniqueSorted([...coverage.coveredNodeIds, ...update.nodeIds])
    : coverage.coveredNodeIds;
  const covered = new Set(coveredNodeIds);
  return Object.freeze({
    ...coverage,
    attemptedCapabilityIds: countsAsAttempt
      ? uniqueSorted([...coverage.attemptedCapabilityIds, update.capabilityId])
      : coverage.attemptedCapabilityIds,
    coveredNodeIds,
    untestedNodeIds: countsAsCoverage
      ? Object.freeze(coverage.untestedNodeIds.filter((nodeId) => !covered.has(nodeId)).sort())
      : coverage.untestedNodeIds,
    requestCount: coverage.requestCount + update.requestCount,
    graphExpansionCount: coverage.graphExpansionCount + graphExpansionCount,
    providerFailureCount: coverage.providerFailureCount + (result.status === "provider_failed" ? 1 : 0),
  });
}

export function evaluateStopConditions(input: StopConditionInput): RunStopReason | undefined {
  if (input.cancelled) return "cancelled";

  const authorizationExpiry = input.authorizationExpiresAt
    ? Date.parse(input.authorizationExpiresAt)
    : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(authorizationExpiry) && input.authorizationExpiresAt) {
    throw new Error("COVERAGE_AUTHORIZATION_EXPIRY_INVALID");
  }
  if (authorizationExpiry <= input.now.getTime()) return "authorization_expired";

  const deadline = Date.parse(input.coverage.deadlineAt);
  if (!Number.isFinite(deadline)) throw new Error("COVERAGE_DEADLINE_INVALID");
  if (deadline <= input.now.getTime()) return "deadline_reached";

  if (input.coverage.requestCount >= input.requestBudget) return "request_budget_exhausted";
  if (input.coverage.graphExpansionCount >= input.graphExpansionLimit) return "graph_expansion_limit";
  if (input.coverage.providerFailureCount >= input.providerFailureLimit) return "provider_failure_limit";
  if (input.approvalRequired) return "approval_required";
  if (input.coverage.untestedNodeIds.length === 0) return "coverage_complete";
  if (input.eligibleHypothesisCount === 0) return "no_eligible_hypotheses";
  return undefined;
}
