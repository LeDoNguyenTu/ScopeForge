import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SecurityStoryPanel from "@/components/findings/SecurityStoryPanel";
import type { SecurityStoryV1 } from "@/lib/security-remediation/types";

const story: SecurityStoryV1 = {
  summary: "Missing security header - medium severity",
  evidence: [
    {
      evidenceId: "evidence-1",
      kind: "http-observation",
      summary: "Header was not present.",
      classification: "public",
      provenanceLabel: "Observed evidence",
    },
  ],
  impact: "The missing header weakens browser-side protection.",
  remediation: {
    guidance: "Return the defensive header.",
    assigneeUserId: "user-2",
    note: "Patch ready.",
    provenanceLabel: "Operator workflow state",
  },
  verification: {
    status: "inconclusive",
    verified: false,
    latestRetestId: "retest-1",
    resultCode: "source_drift",
    provenanceLabel: "Deterministic retest record",
    summary: "The latest deterministic retest was inconclusive and did not verify a fix.",
  },
};

describe("SecurityStoryPanel", () => {
  it("renders deterministic provenance-aware story sections", () => {
    render(<SecurityStoryPanel story={story} />);

    expect(screen.getByText(/missing security header/i)).toBeInTheDocument();
    expect(screen.getByText(/observed evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/operator workflow state/i)).toBeInTheDocument();
    expect(screen.getByText(/deterministic retest record/i)).toBeInTheDocument();
  });
});
