import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebGLAttackSurface from "@/components/dashboard/WebGLAttackSurface";
import { buildAttackSurfaceModel } from "@/lib/dashboard/attack-surface-model";
import { demoAssets, demoFindings } from "@/lib/demo/fixtures";

const model = buildAttackSurfaceModel({ assets: demoAssets, findings: demoFindings });

describe("attack surface without GPU support", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([false, true])("keeps all assets positioned when context acquisition throws=%s", (throws) => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      if (throws) throw new Error("GPU unavailable");
      return null;
    });
    const { container } = render(<WebGLAttackSurface model={model} />);
    expect(screen.getByTestId("webgl-attack-surface")).toHaveAttribute("data-renderer-state", "fallback");
    const labels = [...container.querySelectorAll(".workspaceTopologyLabels g")];
    expect(labels).toHaveLength(8);
    expect(new Set(labels.map(label => label.getAttribute("transform"))).size).toBe(8);
    for (const asset of demoAssets) expect(screen.getByText(asset.name)).toBeInTheDocument();
    for (const label of labels) {
      const [x, y] = label.getAttribute("transform")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      expect(x).toBeGreaterThan(105);
      expect(x).toBeLessThan(900);
      expect(y).toBeGreaterThan(5);
      expect(y).toBeLessThan(540);
    }
    expect(container.querySelector(".workspaceTopologyArt path")).not.toBeNull();
    expect(container.querySelector("[style]")).toBeNull();
  });
});
