import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("pre-PR49 UI rollback with current security", () => {
  it("uses the exact pre-PR49 public landing composition", () => {
    const page = read("app/page.tsx");
    const hero = read("components/landing/CommandCenterLandingHero.tsx");

    expect(page).toContain("<CommandCenterLandingHero />");
    expect(page).not.toContain("LandingBootGate");
    expect(hero).toContain('LandingDataIllustration from "./LandingDataIllustration"');
    expect(hero).toContain("<LandingDataIllustration />");
    expect(hero).not.toContain("CommandCenterSurface");
    expect(hero).not.toContain("CommandCenterHeroDesktopV5");
  });

  it("restores the pre-PR49 SaaS dashboard and shared workspace shell", () => {
    const dashboard = read("components/dashboard/ImmersiveDashboardExperience.tsx");
    const shell = read("components/AppShell.tsx");

    expect(dashboard).toContain('className="saasDashboard"');
    expect(dashboard).toContain("Security overview");
    expect(dashboard).toContain("DashboardWorkbench");
    expect(dashboard).not.toContain('className="livingDashboard"');
    expect(shell).toContain('className="workspaceAppShell"');
    expect(shell).not.toContain('className="immersiveAppShell"');
  });

  it("keeps the old visual language compatible with strict CSP", () => {
    const sample = read("components/landing/LandingDataIllustration.tsx");
    const cinematic = read("components/landing/CinematicSurface.tsx");
    const dashboard = read("components/dashboard/ImmersiveDashboardExperience.tsx");

    expect(sample).not.toContain("style={{");
    expect(cinematic).not.toContain("style={{");
    expect(dashboard).not.toContain("style={{");
    expect(sample).toContain("commandExposureRingGraphic");
    expect(cinematic).toContain("cinematicSceneLabelSlot-${index}");
  });

  it("keeps current CSP and Turnstile integration active", () => {
    const layout = read("app/layout.tsx");
    const auth = read("components/AuthForm.tsx");
    const turnstile = read("components/auth/TurnstileChallenge.tsx");

    expect(layout).toContain('import { connection } from "next/server"');
    expect(layout).toContain('import "./csp-compatibility.css";');
    expect(layout).toContain('import "./saas-dashboard.css";');
    expect(layout).not.toContain('import "./command-center-v5.css";');
    expect(layout).not.toContain('import "./approved-v5-dashboard.css";');
    expect(auth).toContain("Security verification");
    expect(auth).toContain("TurnstileChallenge");
    expect(turnstile).toContain("challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
  });
});
