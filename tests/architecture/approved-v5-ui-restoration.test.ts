import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("approved V5 UI restoration", () => {
  it("uses the approved immersive authenticated dashboard composition", () => {
    const dashboard = read("components/dashboard/ImmersiveDashboardExperience.tsx");

    expect(dashboard).toContain('className="livingDashboard"');
    expect(dashboard).toContain('className="livingDashboardHero"');
    expect(dashboard).toContain('className="livingDashboardScene"');
    expect(dashboard).toContain('className="livingOverviewPanel"');
    expect(dashboard).toContain('className="livingPriorityPanel"');
    expect(dashboard).not.toContain('className="saasDashboard"');
  });

  it("restores the approved public V5 visual scale", () => {
    const primitives = read("components/landing/CommandCenterV5Primitives.tsx");

    expect(primitives).toContain('Explore the platform <ArrowRight size={18} />');
    expect(primitives).toContain('<CirclePlay size={18} /> See it in action');
    expect(primitives).toContain('ccV5MetricIcon"><Icon size={28} />');
    expect(primitives).toContain('Investigate path <ArrowRight size={16} />');
    expect(primitives).toContain('<Radar size={22} />');
    expect(primitives).toContain('<Bug size={22} />');
  });

  it("loads the approved V5 polish layers and drops the superseding SaaS dashboard layer", () => {
    const layout = read("app/layout.tsx");

    expect(layout).toContain('import "./command-center-v5-1.css";');
    expect(layout).toContain('import "./command-center-v5-2.css";');
    expect(layout).not.toContain('import "./saas-dashboard.css";');
  });

  it("keeps the restored dashboard compatible with strict CSP", () => {
    const dashboard = read("components/dashboard/ImmersiveDashboardExperience.tsx");

    expect(dashboard).not.toContain("style={{");
  });
});