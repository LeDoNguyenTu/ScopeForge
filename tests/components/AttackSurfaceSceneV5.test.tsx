import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttackSurfaceSceneV5 from "@/components/landing/AttackSurfaceSceneV5";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

describe("AttackSurfaceSceneV5", () => {
  it("renders a scene-derived WebP poster before or instead of the live canvas", () => {
    render(<AttackSurfaceSceneV5 />);
    const poster = screen.getByTestId("attack-surface-v5-poster");
    expect(poster).toBeInTheDocument();
    expect(poster.querySelector("img")).toHaveAttribute("src", "/command-center-v5-poster-desktop.webp");
  });

  it("uses the separately art-directed mobile WebP poster", () => {
    render(<AttackSurfaceSceneV5 variant="mobile" />);
    const posters = screen.getAllByTestId("attack-surface-v5-poster");
    expect(posters.at(-1)?.querySelector("img")).toHaveAttribute("src", "/command-center-v5-poster-mobile.webp");
  });

  it("keeps semantic labels outside the decorative canvas", () => {
    render(<AttackSurfaceSceneV5 />);
    expect(screen.getByText("WEB APPLICATION")).toBeInTheDocument();
    expect(screen.getByText("DATA STORE")).toBeInTheDocument();
    expect(screen.getByText("CLOUD")).toBeInTheDocument();
    expect(screen.getByTestId("attack-surface-v5-scene").querySelector("canvas")?.getAttribute("aria-hidden")).toBe("true");
  });
});
