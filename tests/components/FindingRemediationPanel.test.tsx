import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FindingRemediationPanel from "@/components/findings/FindingRemediationPanel";
import type { SecurityFindingWorkRow } from "@/lib/database.types";

const work: SecurityFindingWorkRow = {
  workspace_id: "workspace-1",
  finding_id: "finding-1",
  assignee_user_id: "user-2",
  remediation_note: "Patch ready for retest.",
  updated_by: "user-1",
  created_at: "2026-08-25T00:00:00.000Z",
  updated_at: "2026-08-25T00:01:00.000Z",
};

describe("FindingRemediationPanel", () => {
  it("keeps viewers read-only", () => {
    render(<FindingRemediationPanel findingId="finding-1" role="viewer" work={work} />);

    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/patch ready for retest/i)).toBeInTheDocument();
  });

  it("bounds editable remediation notes to 2000 characters", () => {
    render(<FindingRemediationPanel findingId="finding-1" role="member" work={work} />);

    expect(screen.getByRole("textbox", { name: /remediation note/i })).toHaveAttribute("maxlength", "2000");
    expect(screen.getByRole("button", { name: /save remediation/i })).toBeInTheDocument();
  });
});
