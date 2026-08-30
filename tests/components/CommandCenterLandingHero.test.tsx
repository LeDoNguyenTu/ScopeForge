import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommandCenterLandingHero from "@/components/landing/CommandCenterLandingHero";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("CommandCenterLandingHero", () => {
  it("matches the approved command-center information architecture", () => {
    render(<CommandCenterLandingHero />);

    expect(screen.getByText("LIVING ATTACK SURFACE")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Understand the risk before it becomes an incident/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore the platform/i })).toBeInTheDocument();
    expect(screen.getByText("14,892")).toBeInTheDocument();
    expect(screen.getByText("3,271")).toBeInTheDocument();
    expect(screen.getByText("523")).toBeInTheDocument();
    expect(screen.getAllByText("92")).toHaveLength(2);
    expect(screen.getByText("Attack Surface Overview")).toBeInTheDocument();
    expect(screen.getByText("Top risk path")).toBeInTheDocument();
    expect(screen.getByText("Pause monitoring")).toBeInTheDocument();
  });

  it("labels all public metrics as illustrative instead of live workspace data", () => {
    render(<CommandCenterLandingHero />);
    expect(screen.getByText(/Illustrative platform telemetry/i)).toBeInTheDocument();
  });
});
