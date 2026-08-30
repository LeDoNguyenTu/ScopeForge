import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WebGLAttackSurface from "@/components/dashboard/WebGLAttackSurface";
import type { AttackSurfaceModel } from "@/lib/dashboard/attack-surface-model";

const model: AttackSurfaceModel = {
  metrics: {
    registeredAssets: 2,
    verifiedAssets: 2,
    openFindings: 1,
    verificationPercent: 100,
    affectedAssets: 1,
  },
  priority: {
    assetId: "web",
    assetName: "Customer portal",
    severity: "high",
    title: "Missing security header",
  },
  nodes: [
    {
      id: "web",
      kind: "web_application",
      label: "Customer portal",
      canonicalTarget: "https://example.com",
      verificationStatus: "verified",
      state: "risk",
      severity: "high",
      findingCount: 1,
      angle: -145,
      radius: 0.82,
    },
    {
      id: "api",
      kind: "api",
      label: "Payments API",
      canonicalTarget: "https://api.example.com",
      verificationStatus: "verified",
      state: "healthy",
      severity: null,
      findingCount: 0,
      angle: -65,
      radius: 0.78,
    },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("WebGLAttackSurface", () => {
  it("keeps the canvas decorative while exposing real asset labels in the DOM", () => {
    const { container } = render(<WebGLAttackSurface model={model} />);

    expect(screen.getByTestId("webgl-attack-surface")).toBeInTheDocument();
    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Customer portal")).toBeInTheDocument();
    expect(screen.getByText("Payments API")).toBeInTheDocument();
    expect(screen.getByText("1 active finding")).toBeInTheDocument();
    expect(screen.getByText("Verified scope")).toBeInTheDocument();
  });

  it("shows a truthful empty-state prompt when the workspace has no visual nodes", () => {
    render(<WebGLAttackSurface model={{
      nodes: [],
      priority: null,
      metrics: {
        registeredAssets: 0,
        verifiedAssets: 0,
        openFindings: 0,
        verificationPercent: 0,
        affectedAssets: 0,
      },
    }} />);

    expect(screen.getByText("No verified attack surface yet")).toBeInTheDocument();
    expect(screen.getByText(/Add and verify your first asset/i)).toBeInTheDocument();
  });

  it("retains the DOM topology when WebGL is unavailable", () => {
    const { container } = render(<WebGLAttackSurface model={model} />);

    expect(screen.getByText("Customer portal")).toBeInTheDocument();
    expect(container.querySelector('[data-renderer-state="fallback"]')).toBeInTheDocument();
  });
});
