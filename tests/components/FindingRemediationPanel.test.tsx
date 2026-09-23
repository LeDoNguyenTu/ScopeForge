import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FindingRemediationPanel from "@/components/findings/FindingRemediationPanel";
import type { SecurityFindingWorkRow } from "@/lib/database.types";
import { ToastProvider } from "@/components/feedback/ToastProvider";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/app/dashboard/findings/[findingId]/remediation-actions", () => ({ updateFindingRemediationAction: mocks.update }));
const renderPanel = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

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
    renderPanel(<FindingRemediationPanel findingId="finding-1" role="viewer" work={work} />);

    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/patch ready for retest/i)).toBeInTheDocument();
  });

  it("bounds editable remediation notes to 2000 characters", () => {
    renderPanel(<FindingRemediationPanel findingId="finding-1" role="member" work={work} />);

    expect(screen.getByRole("textbox", { name: /remediation note/i })).toHaveAttribute("maxlength", "2000");
    expect(screen.getByRole("button", { name: /save remediation/i })).toBeInTheDocument();
  });

  it("offers workspace members by name instead of asking for a user ID", () => {
    renderPanel(
      <FindingRemediationPanel
        assignees={[
          { userId: "user-1", label: "Brian", detail: "brian@example.com" },
          { userId: "user-2", label: "Meo", detail: "214nsa@gmail.com" },
        ]}
        currentUserId="user-1"
        findingId="finding-1"
        role="owner"
        work={null}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Assignee" })).toHaveValue("");
    expect(screen.getByRole("option", { name: "Brian (brian@example.com)" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Assignee user ID")).not.toBeInTheDocument();
  });

  it("reports a saved remediation as a temporary toast", async () => {
    mocks.update.mockResolvedValue({ ok: true, data: { ...work, remediation_note: "Updated" } });
    render(<ToastProvider><FindingRemediationPanel findingId="finding-1" role="owner" work={work} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: /save remediation/i }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Remediation work updated."));
    expect(document.querySelector(".verificationPanel > .authMessage[role='status']")).toBeNull();
  });
});
