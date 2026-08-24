import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ActiveValidationPanel from "@/components/assets/ActiveValidationPanel";

const succeededJob = {
  id: "active-job-1",
  status: "succeeded" as const,
  blockedReason: null,
  failureCode: null,
  requestCount: 1,
  findingCount: 1,
  cancelRequestedAt: null,
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof ActiveValidationPanel>> = {}) {
  return render(
    <ActiveValidationPanel
      assetId="asset-1"
      assetKind="web_application"
      verificationStatus="verified"
      role="owner"
      latestJob={null}
      observation={null}
      {...overrides}
    />,
  );
}

describe("ActiveValidationPanel", () => {
  it("keeps repository and unverified assets outside the active boundary", () => {
    const { rerender } = renderPanel({ assetKind: "repository" });
    expect(screen.getByText(/repository assets are not supported/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /authorize and run cors check/i })).not.toBeInTheDocument();

    rerender(
      <ActiveValidationPanel
        assetId="asset-1"
        assetKind="web_application"
        verificationStatus="unverified"
        role="owner"
        latestJob={null}
        observation={null}
      />,
    );
    expect(screen.getByText(/verify this asset before authorizing active validation/i)).toBeInTheDocument();
  });

  it.each(["member", "viewer"] as const)("requires owner or admin authorization for %s", (role) => {
    renderPanel({ role });

    expect(screen.getByText(/only workspace owners and admins/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /authorize and run cors check/i })).not.toBeInTheDocument();
  });

  it.each(["owner", "admin"] as const)("shows the fixed active contract to an authorized %s", (role) => {
    renderPanel({ role });

    expect(screen.getByText(/exactly one unauthenticated get/i)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/scopeforge\.invalid/i)).toBeInTheDocument();
    expect(screen.getByText(/no request body, cookies, credentials, redirect following, crawling, fuzzing, or exploit payloads/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /i authorize this one bounded active validation request/i })).not.toBeChecked();
    expect(screen.getByRole("button", { name: /authorize and run cors check/i })).toBeDisabled();
  });

  it("shows active job cancellation separately from passive observation controls", () => {
    renderPanel({
      latestJob: {
        ...succeededJob,
        status: "running",
        requestCount: 0,
        findingCount: 0,
      },
    });

    expect(screen.getByRole("button", { name: /cancel active validation/i })).toBeEnabled();
    expect(screen.queryByText(/cancel passive observation/i)).not.toBeInTheDocument();
  });

  it("shows only bounded normalized CORS evidence on success", () => {
    renderPanel({
      latestJob: succeededJob,
      observation: {
        kind: "cors-policy",
        url: "https://example.com/app",
        status: 200,
        allowedOrigin: "https://scopeforge.invalid",
        credentialsAllowed: true,
        variesOnOrigin: true,
      },
    });

    expect(screen.getByText("1 request")).toBeInTheDocument();
    expect(screen.getByText("1 finding")).toBeInTheDocument();
    expect(screen.getByText("https://scopeforge.invalid")).toBeInTheDocument();
    expect(screen.getByText(/credentials allowed/i)).toBeInTheDocument();
    expect(screen.getByText(/varies on origin/i)).toBeInTheDocument();
  });
});
