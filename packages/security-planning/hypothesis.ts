import type { Hypothesis, HypothesisStatus, Observation } from "./types";
import type { SecurityGraph } from "./graph";

export interface HypothesisRuleContext {
  graph: SecurityGraph;
  observations: readonly Observation[];
}

export interface HypothesisRule {
  ruleId: string;
  derive(context: HypothesisRuleContext): readonly Hypothesis[];
}

const TRANSITIONS: Readonly<Record<HypothesisStatus, ReadonlySet<HypothesisStatus>>> = {
  proposed: new Set(["eligible", "blocked"]),
  eligible: new Set(["testing", "blocked", "exhausted"]),
  blocked: new Set(["eligible", "exhausted"]),
  testing: new Set(["supported", "refuted", "blocked", "exhausted"]),
  supported: new Set(),
  refuted: new Set(),
  exhausted: new Set(),
};

function normalizedHypothesis(hypothesis: Hypothesis): Hypothesis {
  if (!hypothesis.hypothesisId.trim() || !hypothesis.reasoningSource.trim() || !hypothesis.statement.trim()) {
    throw new Error("HYPOTHESIS_IDENTITY_INVALID");
  }
  if (hypothesis.targetNodeIds.length === 0 || hypothesis.candidateCapabilityIds.length === 0) {
    throw new Error("HYPOTHESIS_TARGET_OR_CAPABILITY_REQUIRED");
  }
  if (
    !Number.isFinite(hypothesis.baseConfidence)
    || hypothesis.baseConfidence < 0
    || hypothesis.baseConfidence > 1
    || !Number.isFinite(hypothesis.confidence)
    || hypothesis.confidence < 0
    || hypothesis.confidence > 1
  ) {
    throw new Error("HYPOTHESIS_CONFIDENCE_INVALID");
  }
  if (
    (hypothesis.status === "supported" || hypothesis.status === "refuted")
    && (!hypothesis.evidenceRefs || hypothesis.evidenceRefs.length === 0)
  ) {
    throw new Error("HYPOTHESIS_TERMINAL_EVIDENCE_REQUIRED");
  }

  return Object.freeze({
    ...hypothesis,
    targetNodeIds: Object.freeze([...new Set(hypothesis.targetNodeIds)].sort()),
    preconditions: Object.freeze([...new Set(hypothesis.preconditions)].sort()),
    candidateCapabilityIds: Object.freeze([...new Set(hypothesis.candidateCapabilityIds)].sort()),
    expectedEvidenceTypes: Object.freeze([...new Set(hypothesis.expectedEvidenceTypes)].sort()),
    evidenceRefs: Object.freeze([...new Set(hypothesis.evidenceRefs ?? [])].sort()),
  });
}

export function deriveHypotheses(
  context: HypothesisRuleContext,
  rules: readonly HypothesisRule[],
): readonly Hypothesis[] {
  const byId = new Map<string, Hypothesis>();

  for (const rule of [...rules].sort((a, b) => a.ruleId.localeCompare(b.ruleId))) {
    if (!rule.ruleId.trim()) throw new Error("HYPOTHESIS_RULE_ID_REQUIRED");
    for (const candidate of rule.derive(context)) {
      const normalized = normalizedHypothesis(candidate);
      const existing = byId.get(normalized.hypothesisId);
      if (!existing) {
        byId.set(normalized.hypothesisId, normalized);
        continue;
      }
      if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
        throw new Error("HYPOTHESIS_IDENTITY_CONFLICT");
      }
    }
  }

  return Object.freeze([...byId.values()].sort((a, b) => a.hypothesisId.localeCompare(b.hypothesisId)));
}

export function transitionHypothesis(
  hypothesis: Hypothesis,
  nextStatus: HypothesisStatus,
  options: { confidence?: number; evidenceRefs?: readonly string[] } = {},
): Hypothesis {
  if (!TRANSITIONS[hypothesis.status].has(nextStatus)) {
    throw new Error(`HYPOTHESIS_TRANSITION_INVALID:${hypothesis.status}->${nextStatus}`);
  }

  const confidence = options.confidence ?? hypothesis.confidence;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("HYPOTHESIS_CONFIDENCE_INVALID");
  }
  const evidenceRefs = Object.freeze([
    ...new Set([...(hypothesis.evidenceRefs ?? []), ...(options.evidenceRefs ?? [])]),
  ].sort());

  if ((nextStatus === "supported" || nextStatus === "refuted") && evidenceRefs.length === 0) {
    throw new Error("HYPOTHESIS_TERMINAL_EVIDENCE_REQUIRED");
  }

  return normalizedHypothesis({
    ...hypothesis,
    status: nextStatus,
    confidence,
    evidenceRefs,
  });
}
