import type { ActiveValidationBudget } from "./contracts";

export const ACTIVE_VALIDATION_MAX_BUDGET: Readonly<ActiveValidationBudget> = Object.freeze({
  maxRequests: 1,
  maxRedirects: 0,
  perRequestTimeoutMs: 5_000,
  totalTimeoutMs: 10_000,
  maxObservationBytes: 32_768,
});

function positiveIntegerAtMost(value: number, maximum: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new RangeError(`${label} must be a positive integer at or below ${maximum}.`);
  }
}

export function validateActiveValidationBudget(
  input: ActiveValidationBudget,
): Readonly<ActiveValidationBudget> {
  if (input.maxRequests !== 1) {
    throw new RangeError("Active validation request count must be exactly 1.");
  }
  if (input.maxRedirects !== 0) {
    throw new RangeError("Active validation redirect count must be exactly 0.");
  }
  positiveIntegerAtMost(
    input.perRequestTimeoutMs,
    ACTIVE_VALIDATION_MAX_BUDGET.perRequestTimeoutMs,
    "Per-request timeout",
  );
  positiveIntegerAtMost(
    input.totalTimeoutMs,
    ACTIVE_VALIDATION_MAX_BUDGET.totalTimeoutMs,
    "Total timeout",
  );
  positiveIntegerAtMost(
    input.maxObservationBytes,
    ACTIVE_VALIDATION_MAX_BUDGET.maxObservationBytes,
    "Observation budget",
  );

  if (input.totalTimeoutMs < input.perRequestTimeoutMs) {
    throw new RangeError("Total timeout must not be shorter than the per-request timeout.");
  }

  return Object.freeze({ ...input });
}
