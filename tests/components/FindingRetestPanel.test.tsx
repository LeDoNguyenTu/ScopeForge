import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FindingRetestPanel from "@/components/findings/FindingRetestPanel";

describe("FindingRetestPanel", () => {
  it("allows members to run supported passive retests without active consent UI", () => {
    render(
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
    render(
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
    render(
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
});
