import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByText("86%")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "6 of 7 assets have verified ownership" })).toBeInTheDocument();
    expect(screen.getByText("Attack Surface Overview")).toBeInTheDocument();
    expect(screen.getByText("How an exposure could spread")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Sample attack surface: 7 assets, 3 open findings, 2 affected assets/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause monitoring" })).not.toBeInTheDocument();
  });

  it("labels all public metrics as illustrative instead of live workspace data", () => {
    render(<CommandCenterLandingHero />);
    expect(screen.getByText(/Interactive example · Sample data/i)).toBeInTheDocument();
  });

  it("preserves the approved artwork and updates its labels with sample counts", () => {
    const { container } = render(<CommandCenterLandingHero />);
    expect(container.querySelectorAll('[data-asset-node]')).toHaveLength(7);
    expect(container.querySelector('image')).toHaveAttribute('href', '/command-center-cinematic.webp');
    expect(screen.getByText('2 findings · example')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'After verified fix' }));
    expect(screen.getByRole('status')).toHaveTextContent('0 open findings across 0 assets');
    expect(container.querySelector('.cinematicSurfaceRemediated')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-asset-node]')).toHaveLength(7);
    expect(screen.queryByText('2 findings · example')).not.toBeInTheDocument();
    expect(screen.getByText('86%')).toBeInTheDocument();
    expect(screen.getByText('Needs proof')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Before remediation' }));
    expect(screen.getByRole('status')).toHaveTextContent('3 open findings across 2 assets');
    expect(screen.getByText('2 findings · example')).toBeInTheDocument();
  });
});
