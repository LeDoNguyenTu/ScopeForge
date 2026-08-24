import type { FindingLifecycleState } from "./types";

const ALLOWED_TRANSITIONS: Readonly<Record<FindingLifecycleState, readonly FindingLifecycleState[]>> = {
  open: ["acknowledged", "in_progress", "accepted_risk", "false_positive"],
  acknowledged: ["in_progress", "accepted_risk", "false_positive"],
  in_progress: ["resolved", "accepted_risk", "false_positive"],
  resolved: ["retest_pending", "in_progress"],
  retest_pending: ["verified_fixed", "open", "in_progress"],
  verified_fixed: ["open"],
  accepted_risk: ["open", "in_progress"],
  false_positive: [],
};

export function canTransitionFindingLifecycle(
  from: FindingLifecycleState,
  to: FindingLifecycleState,
): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}
