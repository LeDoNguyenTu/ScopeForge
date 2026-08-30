import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttackSurfaceScene from "@/components/landing/AttackSurfaceScene";

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

describe("AttackSurfaceScene", () => {
  it("keeps a complete fallback visible when WebGL is unavailable", async () => {
    const { container } = render(<AttackSurfaceScene />);

    expect(await screen.findByTestId("attack-surface-fallback")).toBeVisible();
    expect(screen.getByText("WEB APPLICATION")).toBeInTheDocument();
    expect(screen.getByText("DATA STORE")).toBeInTheDocument();
    expect(screen.getByText("IDENTITY")).toBeInTheDocument();
    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
  });

  it("marks the visual as a dimensional command-center scene without making the canvas semantic content", () => {
    render(<AttackSurfaceScene />);
    expect(screen.getByTestId("attack-surface-scene")).toHaveAttribute("data-scene-depth", "3d");
    expect(screen.getByTestId("attack-surface-scene")).toHaveAttribute("aria-label", "Illustrative ScopeForge living attack surface");
  });
});
