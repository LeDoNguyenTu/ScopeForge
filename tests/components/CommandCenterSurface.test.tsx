import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommandCenterSurface from "@/components/landing/CommandCenterSurface";

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

describe("CommandCenterSurface", () => {
  it("keeps the WebGL canvas decorative while exposing the illustrated security domains in the DOM", () => {
    const { container } = render(<CommandCenterSurface />);

    expect(screen.getByTestId("command-center-surface")).toBeInTheDocument();
    expect(screen.getByTestId("command-center-surface")).toHaveAttribute("data-scene-depth", "3d");
    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("WEB APPLICATION")).toBeInTheDocument();
    expect(screen.getByText("DATA STORE")).toBeInTheDocument();
    expect(screen.getByText("IDENTITY")).toBeInTheDocument();
    expect(screen.getByText("THIRD PARTY")).toBeInTheDocument();
    expect(screen.getByText("SANDBOX")).toBeInTheDocument();
  });

  it("retains a complete visible topology fallback when WebGL is unavailable", () => {
    render(<CommandCenterSurface />);

    expect(screen.getByTestId("command-center-surface")).toHaveAttribute("data-renderer-state", "fallback");
    expect(screen.getByText("2 Findings")).toBeInTheDocument();
    expect(screen.getByText("At Risk")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });
});
