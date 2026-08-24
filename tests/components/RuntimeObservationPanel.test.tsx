import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RuntimeObservationPanel from "@/components/assets/RuntimeObservationPanel";

const succeededJob = {
  id: "job-1",
  status: "succeeded" as const,
  blockedReason: null,
  failureCode: null,
  requestCount: 2,
  redirectCount: 1,
  findingCount: 2,
  cancelRequestedAt: null,
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof RuntimeObservationPanel>> = {}) {
  return render(
    <RuntimeObservationPanel
      assetId="asset-1"
      assetKind="web_application"
      verificationStatus="verified"
      latestJob={null}
      observations={[]}
      {...overrides}
    />,
  );
}

describe("RuntimeObservationPanel", () => {
  it("explains why an unverified asset cannot run a passive observation", () => {
    renderPanel({ verificationStatus: "unverified" });

    expect(screen.getByText(/verify this asset before running a passive observation/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /run passive observation/i })).not.toBeInTheDocument();
  });

  it("marks repository assets as unsupported", () => {
    renderPanel({ assetKind: "repository" });

    expect(screen.getByText(/repository assets are not supported by passive runtime observations/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /run passive observation/i })).not.toBeInTheDocument();
  });

  it.each(["web_application", "api"] as const)(
    "allows a verified %s asset to start the bounded observation",
    (assetKind) => {
      renderPanel({ assetKind });

      expect(screen.getByRole("button", { name: /run passive observation/i })).toBeEnabled();
      expect(screen.getByText(/https only/i)).toBeInTheDocument();
      expect(screen.getByText(/no crawling, fuzzing, authentication replay, or exploit payloads/i)).toBeInTheDocument();
    },
  );

  it.each(["queued", "running"] as const)(
    "shows %s job state with a cancel action",
    (status) => {
      renderPanel({
        latestJob: {
          ...succeededJob,
          status,
          requestCount: 0,
          redirectCount: 0,
          findingCount: 0,
        },
      });

      expect(screen.getByText(new RegExp(status, "i"))).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancel passive observation/i })).toBeEnabled();
    },
  );

  it("shows bounded success counts and HTTP/TLS summaries", () => {
    renderPanel({
      latestJob: succeededJob,
      observations: [
        {
          kind: "header",
          name: "strict-transport-security",
          present: false,
        },
        {
          kind: "tls",
          protocol: "TLSv1.3",
          validFrom: "2026-08-01T00:00:00.000Z",
          validTo: "2026-11-01T00:00:00.000Z",
          subjectAltName: "DNS:example.com",
        },
      ],
    });

    expect(screen.getByText("2 requests")).toBeInTheDocument();
    expect(screen.getByText("1 redirect")).toBeInTheDocument();
    expect(screen.getByText("2 findings")).toBeInTheDocument();
    expect(screen.getByText(/strict-transport-security: missing/i)).toBeInTheDocument();
    expect(screen.getByText(/tlsv1.3/i)).toBeInTheDocument();
  });

  it.each([
    ["blocked", "RUNTIME_AUTHORIZATION_CHANGED", "The asset authorization changed before execution."],
    ["failed", "NETWORK_ERROR", "The passive observation could not complete because of a network error."],
  ] as const)("shows a stable safe reason for %s jobs", (status, failureCode, expectedMessage) => {
    renderPanel({
      latestJob: {
        ...succeededJob,
        status,
        failureCode,
        blockedReason: null,
      },
    });

    expect(screen.getByText(expectedMessage)).toBeInTheDocument();
  });
});
