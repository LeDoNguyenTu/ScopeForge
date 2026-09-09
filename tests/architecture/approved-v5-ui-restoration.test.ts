import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("approved Command Center UI restoration", () => {
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

  it("restores the approved public command-center composition and original WebGL surface", () => {
    const hero = read("components/landing/CommandCenterLandingHero.tsx");
    const surface = read("components/landing/CommandCenterSurface.tsx");

    expect(hero).toContain('className="commandHero"');
    expect(hero).toContain("Attack Surface Overview");
    expect(hero).toContain("Top risk path");
    expect(hero).toContain("Pause monitoring");
    expect(hero).toContain("<CommandCenterSurface />");
    expect(hero).not.toContain("CommandCenterHeroDesktopV5");
    expect(surface).toContain('canvas.getContext("webgl"');
    expect(surface).toContain("const ARMS: readonly Arm[]");
  });

  it("loads the approved command-center and dashboard cascade after superseding refinements", () => {
    const layout = read("app/layout.tsx");
    const exact = layout.indexOf('import "./exact-command-center.css";');
    const csp = layout.indexOf('import "./csp-compatibility.css";');
    const approvedDashboard = layout.indexOf('import "./approved-v5-dashboard.css";');
    const approvedV3 = layout.indexOf('import "./approved-command-center-v3.css";');
    const cascadeGuard = read("app/approved-v5-dashboard.css");

    expect(layout).not.toContain('import "./saas-dashboard.css";');
    expect(exact).toBeGreaterThanOrEqual(0);
    expect(csp).toBeGreaterThan(exact);
    expect(approvedDashboard).toBeGreaterThan(csp);
    expect(approvedV3).toBeGreaterThan(approvedDashboard);
    expect(cascadeGuard).toContain(".immersiveAppShell .livingDashboardHero");
    expect(cascadeGuard).toContain(".immersiveAppShell .livingDashboardScene");
    expect(cascadeGuard).toContain(".immersiveAppShell .livingDashboardLower");
  });

  it("keeps both restored WebGL presentation paths compatible with strict CSP", () => {
    const dashboard = read("components/dashboard/ImmersiveDashboardExperience.tsx");
    const topology = read("components/dashboard/WebGLAttackSurface.tsx");
    const publicSurface = read("components/landing/CommandCenterSurface.tsx");

    expect(dashboard).toContain('from "@/components/dashboard/WebGLAttackSurface"');
    expect(dashboard).not.toContain("CspSafeAttackSurface");
    expect(dashboard).not.toContain("style={{");
    expect(topology).not.toMatch(/style\s*=\s*\{/);
    expect(publicSurface).not.toMatch(/style\s*=\s*\{/);
  });
});
