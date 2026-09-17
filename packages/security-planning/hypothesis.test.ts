import { describe, expect, it } from "vitest";
import { deriveHypotheses, transitionHypothesis } from "./hypothesis";
import { emptyGraph } from "./graph";
import type { Hypothesis } from "./types";

function hypothesis(status: Hypothesis["status"] = "proposed"): Hypothesis {
  return {
    hypothesisId: "hypothesis-1",
    reasoningSource: "rule.http.exposure",
    targetNodeIds: ["node-1"],
    statement: "Observed HTTP service may expose an administrative route.",
    preconditions: ["http_service_observed"],
    candidateCapabilityIds: ["web.route.discover.v1"],
    expectedEvidenceTypes: ["web.route"],
    baseConfidence: 0.4,
    confidence: 0.4,
    status,
    evidenceRefs: [],
  };
}

describe("Phase 11 hypothesis lifecycle", () => {
  it("derives hypotheses deterministically from explicitly registered rules", () => {
    const rules = [
      {
        ruleId: "b-rule",
        derive: () => [{ ...hypothesis(), hypothesisId: "b", reasoningSource: "b-rule" }],
      },
      {
        ruleId: "a-rule",
        derive: () => [{ ...hypothesis(), hypothesisId: "a", reasoningSource: "a-rule" }],
      },
    ];

    expect(deriveHypotheses({ graph: emptyGraph(), observations: [] }, rules).map((item) => item.hypothesisId))
      .toEqual(["a", "b"]);
  });

  it("allows only reviewed lifecycle transitions", () => {
    const eligible = transitionHypothesis(hypothesis(), "eligible");
    const testing = transitionHypothesis(eligible, "testing");
    const supported = transitionHypothesis(testing, "supported", {
      confidence: 0.95,
      evidenceRefs: ["evidence-1"],
    });

    expect(supported.status).toBe("supported");
    expect(supported.evidenceRefs).toEqual(["evidence-1"]);
    expect(() => transitionHypothesis(hypothesis(), "supported", { evidenceRefs: ["evidence-1"] }))
      .toThrow("HYPOTHESIS_TRANSITION_INVALID");
  });

  it("does not allow a supported/refuted terminal state without evidence", () => {
    const testing = transitionHypothesis(transitionHypothesis(hypothesis(), "eligible"), "testing");
    expect(() => transitionHypothesis(testing, "supported")).toThrow("HYPOTHESIS_TERMINAL_EVIDENCE_REQUIRED");
    expect(() => transitionHypothesis(testing, "refuted")).toThrow("HYPOTHESIS_TERMINAL_EVIDENCE_REQUIRED");
  });

  it("rejects conflicting duplicate hypothesis identities", () => {
    expect(() => deriveHypotheses(
      { graph: emptyGraph(), observations: [] },
      [
        { ruleId: "a", derive: () => [{ ...hypothesis(), hypothesisId: "same", reasoningSource: "a" }] },
        { ruleId: "b", derive: () => [{ ...hypothesis(), hypothesisId: "same", reasoningSource: "b", statement: "Different" }] },
      ],
    )).toThrow("HYPOTHESIS_IDENTITY_CONFLICT");
  });
});
