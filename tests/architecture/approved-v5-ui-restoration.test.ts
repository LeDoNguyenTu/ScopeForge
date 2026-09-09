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

  it("restores the approved immersive shell while keeping the default workspace shell", () => {
    const shell = read("components/AppShell.tsx");

    expect(shell).toContain('if (variant === "immersive")');
    expect(shell).toContain('className="immersiveAppShell"');
    expect(shell).toContain('className="immersiveContent"');
    expect(shell).toContain("<SideNav />");
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

  it("loads the approved V5 polish and dashboard cascade after superseding refinements", () => {
    const layout = read("app/layout.tsx");
    const refinement = layout.indexOf('import "./ui-refinement.css";');
    const immersive = layout.indexOf('import "./forge-dashboard-v2.css";');
    const csp = layout.indexOf('import "./csp-compatibility.css";');
    const approvedDashboard = layout.indexOf('import "./approved-v5-dashboard.css";');
    const cascadeGuard = read("app/approved-v5-dashboard.css");

    expect(layout).toContain('import "./command-center-v5-1.css";');
    expect(layout).toContain('import "./command-center-v5-2.css";');
    expect(layout).not.toContain('import "./saas-dashboard.css";');
    expect(refinement).toBeGreaterThanOrEqual(0);
    expect(immersive).toBeGreaterThan(refinement);
    expect(csp).toBeGreaterThan(immersive);
    expect(approvedDashboard).toBeGreaterThan(csp);
    expect(cascadeGuard).toContain(".immersiveAppShell .livingDashboardHero");
    expect(cascadeGuard).toContain("display: block;");
    expect(cascadeGuard).toContain(".immersiveAppShell .livingDashboardScene");
    expect(cascadeGuard).toContain("position: absolute;");
    expect(cascadeGuard).toContain(".immersiveAppShell .livingDashboardLower");
  });

  it("keeps every restored authenticated dashboard presentation path compatible with strict CSP", () => {
    const dashboard = read("components/dashboard/ImmersiveDashboardExperience.tsx");
    const topology = read("components/dashboard/CspSafeAttackSurface.tsx");

    expect(dashboard).toContain('from "@/components/dashboard/CspSafeAttackSurface"');
    expect(dashboard).not.toContain('from "@/components/dashboard/WebGLAttackSurface"');
    expect(dashboard).not.toContain("style={{");
    expect(topology).not.toContain("style={");
    expect(topology).not.toContain("style={{");
  });
});
