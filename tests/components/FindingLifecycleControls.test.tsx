import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FindingLifecycleControls from "@/components/findings/FindingLifecycleControls";

function renderControls(
  overrides: Partial<React.ComponentProps<typeof FindingLifecycleControls>> = {},
) {
  return render(
    <FindingLifecycleControls
      findingId="finding-1"
      lifecycleState="open"
      role="member"
      {...overrides}
    />,
  );
}

describe("FindingLifecycleControls", () => {
  it("keeps viewers read-only", () => {
    renderControls({ role: "viewer" });

    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows only acknowledge and start work for open findings", () => {
    renderControls();

    expect(screen.getByRole("button", { name: /acknowledge/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /start work/i })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /resolve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reopen/i })).not.toBeInTheDocument();
  });

  it("requires a note before resolving an in-progress finding", () => {
    renderControls({ lifecycleState: "in_progress", role: "admin" });

    const note = screen.getByRole("textbox", { name: /resolution note/i });
    expect(note).toBeRequired();
    expect(screen.getByRole("button", { name: /^resolve$/i })).toBeDisabled();
  });

  it("requires a note before reopening a resolved finding", () => {
    renderControls({ lifecycleState: "resolved", role: "owner" });

    const note = screen.getByRole("textbox", { name: /reopen note/i });
    expect(note).toBeRequired();
    expect(screen.getByRole("button", { name: /^reopen$/i })).toBeDisabled();
  });

  it("never exposes risk, false-positive, retest, or verified-fixed controls", () => {
    renderControls({ lifecycleState: "open", role: "owner" });
    const body = document.body.textContent ?? "";

    expect(body).not.toMatch(/accepted risk|false positive|retest|verified fixed/i);
  });
});
