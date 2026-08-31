import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommandCenterLandingHero from "@/components/landing/CommandCenterLandingHero";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width"),
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

describe("CommandCenterLandingHero", () => {
  it("exposes independently authored desktop and mobile compositions", () => {
    render(<CommandCenterLandingHero />);
    expect(screen.getByTestId("command-center-v5-desktop")).toBeInTheDocument();
    expect(screen.getByTestId("command-center-v5-mobile")).toBeInTheDocument();
    expect(screen.getAllByTestId("command-copy")).toHaveLength(2);
    expect(screen.getAllByTestId("command-scene")).toHaveLength(2);
  });

  it("preserves the public command-center information hierarchy and real destinations", () => {
    render(<CommandCenterLandingHero />);
    expect(screen.getAllByText(/Living attack surface/i)).toHaveLength(2);
    expect(screen.getAllByRole("heading", { name: /Understand the risk before it becomes an incident/i })).toHaveLength(2);
    const platformLinks = screen.getAllByRole("link", { name: /Explore the platform/i });
    expect(platformLinks).toHaveLength(2);
    platformLinks.forEach((link) => expect(link).toHaveAttribute("href", "/auth/sign-up"));
    expect(screen.getAllByText("Attack surface overview")).toHaveLength(2);
    expect(screen.getAllByText("Top illustrative risk path")).toHaveLength(2);
  });

  it("labels all public metrics as illustrative instead of live workspace data", () => {
    render(<CommandCenterLandingHero />);
    expect(screen.getAllByText(/Illustrative platform telemetry/i)).toHaveLength(2);
    expect(screen.getAllByText(/Illustrative risk topology/i)).toHaveLength(2);
    expect(screen.getAllByLabelText(/Illustrative scene runtime status/i)).toHaveLength(2);
  });

  it("keeps the animation pause control available in each art-directed composition", () => {
    render(<CommandCenterLandingHero />);
    expect(screen.getAllByRole("button", { name: /Pause animation/i })).toHaveLength(2);
  });
});
