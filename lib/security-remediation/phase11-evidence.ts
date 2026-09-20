import type { Observation } from "@/packages/security-planning";
import {
  evaluatePhase11RetestObservation,
  type Phase11RetestDecision,
} from "@/packages/pentest-continuous";

export interface Phase11RemediationRetestInput {
  findingFingerprint: string;
  requestedAt: string;
  expectedCapabilityId: string;
  observation: Observation;
}

export function classifyPhase11RemediationRetest(
  input: Phase11RemediationRetestInput,
): Phase11RetestDecision {
  return evaluatePhase11RetestObservation(input);
}
