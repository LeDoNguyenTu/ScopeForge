import type { RuntimeObservationBudget } from "./contracts";

export const RUNTIME_OBSERVATION_MAX_BUDGET: Readonly<RuntimeObservationBudget> = Object.freeze({
  maxRequests: 4,
  maxRedirects: 3,
  perRequestTimeoutMs: 5_000,
  totalTimeoutMs: 15_000,
  maxObservationBytes: 65_536,
});

function assertIntegerWithinMaximum(
  value: number,
  name: keyof RuntimeObservationBudget,
  maximum: number,
  allowZero: boolean,
): void {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
}

export function validateRuntimeObservationBudget(
  input: RuntimeObservationBudget,
): Readonly<RuntimeObservationBudget> {
  assertIntegerWithinMaximum(
    input.maxRequests,
    "maxRequests",
    RUNTIME_OBSERVATION_MAX_BUDGET.maxRequests,
    false,
  );
  assertIntegerWithinMaximum(
    input.maxRedirects,
    "maxRedirects",
    RUNTIME_OBSERVATION_MAX_BUDGET.maxRedirects,
    true,
  );
  assertIntegerWithinMaximum(
    input.perRequestTimeoutMs,
    "perRequestTimeoutMs",
    RUNTIME_OBSERVATION_MAX_BUDGET.perRequestTimeoutMs,
    false,
  );
  assertIntegerWithinMaximum(
    input.totalTimeoutMs,
    "totalTimeoutMs",
    RUNTIME_OBSERVATION_MAX_BUDGET.totalTimeoutMs,
    false,
  );
  assertIntegerWithinMaximum(
    input.maxObservationBytes,
    "maxObservationBytes",
    RUNTIME_OBSERVATION_MAX_BUDGET.maxObservationBytes,
    false,
  );

  return Object.freeze({ ...input });
}
