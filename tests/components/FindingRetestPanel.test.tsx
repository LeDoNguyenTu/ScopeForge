import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FindingRetestPanel from "@/components/findings/FindingRetestPanel";
import { ToastProvider } from "@/components/feedback/ToastProvider";

const mocks = vi.hoisted(() => ({ retest: vi.fn() }));
vi.mock("@/app/dashboard/findings/[findingId]/remediation-actions", () => ({ runFindingRetestAction: mocks.retest }));
const renderPanel = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

describe("FindingRetestPanel", () => {
  it("allows members to run supported passive retests without active consent UI", () => {
    renderPanel(
      <FindingRetestPanel
        findingId="finding-1"
        lifecycleState="resolved"
        role="member"
        executionKind="passive_runtime"
        retests={[]}
      />,
    );

    expect(screen.getByRole("button", { name: /run retest/i })).toBeEnabled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("requires explicit consent for owner/admin active CORS retests", () => {
    renderPanel(
      <FindingRetestPanel
        findingId="finding-1"
        lifecycleState="resolved"
        role="owner"
        executionKind="active_validation"
        retests={[]}
      />,
    );

    expect(screen.getByRole("checkbox", { name: /explicit consent/i })).toBeRequired();
    expect(screen.getByRole("button", { name: /run retest/i })).toBeDisabled();
  });

  it("does not expose active execution to members", () => {
    renderPanel(
      <FindingRetestPanel
        findingId="finding-1"
        lifecycleState="resolved"
        role="member"
        executionKind="active_validation"
        retests={[]}
      />,
    );

    expect(screen.getByText(/owner or admin/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /run retest/i })).not.toBeInTheDocument();
  });

  it("reports a completed retest as a temporary toast", async () => {
    mocks.retest.mockResolvedValue({ ok: true, data: { id: "retest-1", status: "passed", execution_kind: "passive_runtime", result_code: "ok", requested_at: "2026-09-23T00:00:00.000Z" } });
    render(<ToastProvider><FindingRetestPanel findingId="finding-1" lifecycleState="resolved" role="member" executionKind="passive_runtime" retests={[]} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: /run retest/i }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Finding retest completed."));
    expect(document.querySelector(".verificationPanel > .authMessage[role='status']")).toBeNull();
  });
});
