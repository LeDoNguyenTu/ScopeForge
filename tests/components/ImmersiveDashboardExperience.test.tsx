import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImmersiveDashboardExperience from "@/components/dashboard/ImmersiveDashboardExperience";
import type { AttackSurfaceModel } from "@/lib/dashboard/attack-surface-model";

vi.mock("@/components/dashboard/WebGLAttackSurface", () => ({
  default: () => <div data-testid="webgl-scene">WebGL scene</div>,
}));

const model: AttackSurfaceModel = {
  nodes: [
    {
      id: "asset-a",
      kind: "web_application",
      label: "Customer portal",
      canonicalTarget: "https://example.com",
      verificationStatus: "verified",
      state: "risk",
      severity: "high",
      findingCount: 2,
      angle: -120,
      radius: 0.8,
    },
  ],
  metrics: {
    registeredAssets: 4,
    verifiedAssets: 3,
    openFindings: 7,
    verificationPercent: 75,
    affectedAssets: 1,
  },
  priority: {
    assetId: "asset-a",
    assetName: "Customer portal",
    severity: "high",
    title: "Missing security header",
  },
};

describe("ImmersiveDashboardExperience", () => {
  it("puts workspace metrics and the work queue ahead of the optional map", () => {
    render(<ImmersiveDashboardExperience
      model={model}
      nextAction={{
        href: "/dashboard/findings",
        label: "Review findings",
        title: "7 findings need review",
        copy: "Review canonical evidence before choosing the next remediation step.",
      }}
    />);

    expect(screen.getByText("WORKSPACE OVERVIEW")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Security overview" })).toBeInTheDocument();
    expect(screen.getByTestId("webgl-scene")).toBeInTheDocument();
    expect(screen.getByText("Registered assets")).toBeInTheDocument();
    expect(screen.getByText("Verified assets")).toBeInTheDocument();
    expect(screen.getByText("Open findings")).toBeInTheDocument();
    expect(screen.getByText("Verification coverage")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Workspace work queue" })).toBeInTheDocument();
    const reviewLinks = screen.getAllByRole("link", { name: /Review findings/i });
    expect(reviewLinks).toHaveLength(1);
    expect(reviewLinks.every((link) => link.getAttribute("href") === "/dashboard/findings")).toBe(true);
  });

  it("does not present concept-only telemetry as real workspace facts", () => {
    render(<ImmersiveDashboardExperience
      model={model}
      nextAction={{
        href: "/dashboard/assets",
        label: "Review assets",
        title: "Verified scope is ready",
        copy: "Review the assets in this workspace.",
      }}
    />);

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/sensors/i);
    expect(text).not.toMatch(/risk paths/i);
    expect(text).not.toMatch(/exposure score/i);
  });

  it("shows a truthful no-finding priority state", () => {
    render(<ImmersiveDashboardExperience
      model={{
        nodes: [],
        priority: null,
        metrics: {
          registeredAssets: 0,
          verifiedAssets: 0,
          openFindings: 0,
          verificationPercent: 0,
          affectedAssets: 0,
        },
      }}
      nextAction={{
        href: "/dashboard/assets/new",
        label: "Register asset",
        title: "Register your first asset",
        copy: "Define an asset that belongs in the authorized workspace scope.",
      }}
    />);

    expect(screen.getByRole("heading", { name: "No findings to review yet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Register your first asset" })).toBeInTheDocument();
    expect(screen.queryByText("Topology active")).not.toBeInTheDocument();
  });
});
