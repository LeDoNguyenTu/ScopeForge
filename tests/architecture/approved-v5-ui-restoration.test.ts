import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("post-PR49 UI remains inactive after rollback", () => {
  it("does not activate the V5 split hero or boot gate", () => {
    const page = read("app/page.tsx");
    const hero = read("components/landing/CommandCenterLandingHero.tsx");
    const layout = read("app/layout.tsx");

    expect(page).not.toContain("LandingBootGate");
    expect(hero).not.toContain("CommandCenterHeroDesktopV5");
    expect(hero).not.toContain("CommandCenterHeroMobileV5");
    expect(layout).not.toContain('import "./command-center-boot.css";');
    expect(layout).not.toContain('import "./command-center-v5.css";');
    expect(layout).not.toContain('import "./command-center-v5-1.css";');
    expect(layout).not.toContain('import "./command-center-v5-2.css";');
  });

  it("does not activate the later living dashboard shell", () => {
    const dashboard = read("components/dashboard/ImmersiveDashboardExperience.tsx");
    const shell = read("components/AppShell.tsx");
    const layout = read("app/layout.tsx");

    expect(dashboard).toContain('className="saasDashboard"');
    expect(dashboard).not.toContain('className="livingDashboard"');
    expect(shell).toContain('className="workspaceAppShell"');
    expect(shell).not.toContain('className="immersiveAppShell"');
    expect(layout).toContain('import "./saas-dashboard.css";');
    expect(layout).not.toContain('import "./approved-command-center-v3.css";');
  });

  it("preserves modern security compatibility around the old UI", () => {
    const layout = read("app/layout.tsx");
    const sample = read("components/landing/LandingDataIllustration.tsx");
    const cinematic = read("components/landing/CinematicSurface.tsx");

    expect(layout).toContain("await connection()");
    expect(layout).toContain('import "./csp-compatibility.css";');
    expect(layout).toContain('import "./pre-pr49-ui-compatibility.css";');
    expect(sample).not.toMatch(/style\s*=\s*\{/);
    expect(cinematic).not.toMatch(/style\s*=\s*\{/);
  });
});
