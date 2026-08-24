import type { ValidationAuthority, ValidationState } from "./types";

const DETERMINISTIC_TRANSITIONS: Readonly<Record<ValidationState, readonly ValidationState[]>> = {
  unvalidated: ["static_confirmed", "runtime_observed", "runtime_validated"],
  static_confirmed: ["runtime_observed", "runtime_validated"],
  runtime_observed: ["runtime_validated"],
  runtime_validated: [],
  user_confirmed: [],
};

export function canTransitionValidation(
  from: ValidationState,
  to: ValidationState,
  authority: ValidationAuthority,
): boolean {
  if (from === to) {
    return true;
  }

  if (authority === "advisory") {
    return false;
  }

  if (authority === "human") {
    return to === "user_confirmed";
  }

  if (to === "user_confirmed") {
    return false;
  }

  return DETERMINISTIC_TRANSITIONS[from].includes(to);
}
