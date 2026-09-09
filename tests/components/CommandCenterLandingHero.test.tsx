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
  it("renders the approved responsive command-center composition and dimensional attack surface", () => {
    const { container } = render(<CommandCenterLandingHero />);

    expect(container.querySelector(".commandHero")).toBeInTheDocument();
    expect(container.querySelector(".commandHeroCopy")).toBeInTheDocument();
    expect(container.querySelector(".commandHeroScene")).toBeInTheDocument();
    expect(screen.getByTestId("command-center-surface")).toHaveAttribute("data-scene-depth", "3d");
    expect(container.querySelector("canvas.commandSurfaceCanvas")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByTestId("command-center-v5-desktop")).not.toBeInTheDocument();
    expect(screen.queryByTestId("command-center-v5-mobile")).not.toBeInTheDocument();
  });

  it("preserves the approved public information hierarchy and real destinations", () => {
    render(<CommandCenterLandingHero />);

    expect(screen.getByText(/Living attack surface/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Understand the risk before it becomes an incident/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore the platform/i })).toHaveAttribute("href", "/auth/sign-up");
    expect(screen.getByRole("link", { name: /See it in action/i })).toHaveAttribute("href", "#platform");
    expect(screen.getByText("Attack Surface Overview")).toBeInTheDocument();
    expect(screen.getByText("Top risk path")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Investigate path/i })).toHaveAttribute("href", "/auth/sign-up");
  });

  it("labels public telemetry and runtime status as illustrative rather than workspace facts", () => {
    render(<CommandCenterLandingHero />);

    expect(screen.getByText(/Illustrative platform telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/Live illustration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Illustrative runtime status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Illustrative ScopeForge living attack surface/i)).toBeInTheDocument();
  });

  it("keeps the approved monitoring pause control available", () => {
    render(<CommandCenterLandingHero />);
    expect(screen.getByRole("button", { name: /Pause monitoring/i })).toBeInTheDocument();
  });
});
