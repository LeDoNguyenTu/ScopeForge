import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("approved Command Center UI v3 restoration", () => {
  it("uses the approved public command-center composition instead of the later V5 split hero", () => {
    const hero = read("components/landing/CommandCenterLandingHero.tsx");

    expect(hero).toContain('CommandCenterSurface from "@/components/landing/CommandCenterSurface"');
    expect(hero).toContain('className="commandHero"');
    expect(hero).toContain("Attack Surface Overview");
    expect(hero).toContain("Top risk path");
    expect(hero).toContain("Pause monitoring");
    expect(hero).not.toContain("CommandCenterHeroDesktopV5");
    expect(hero).not.toContain("CommandCenterHeroMobileV5");
  });

  it("restores the original dimensional WebGL public attack surface", () => {
    const path = "components/landing/CommandCenterSurface.tsx";
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;

    const surface = read(path);
    expect(surface).toContain('canvas.getContext("webgl"');
    expect(surface).toContain("const ARMS: readonly Arm[]");
    expect(surface.match(/angle:/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(surface).toContain("commandSurfaceLabelWeb");
    expect(surface).toContain("commandSurfaceLabelData");
    expect(surface).not.toMatch(/style\s*=\s*\{/);
  });

  it("uses the approved live WebGL topology after login rather than the replacement SVG approximation", () => {
    const dashboard = read("components/dashboard/ImmersiveDashboardExperience.tsx");
    const path = "components/dashboard/WebGLAttackSurface.tsx";

    expect(dashboard).toContain('WebGLAttackSurface from "@/components/dashboard/WebGLAttackSurface"');
    expect(dashboard).toContain("<WebGLAttackSurface model={model} />");
    expect(dashboard).not.toContain("CspSafeAttackSurface");
    expect(existsSync(path)).toBe(true);
  });

  it("keeps the restored authenticated topology compatible with strict CSP", () => {
    const path = "components/dashboard/WebGLAttackSurface.tsx";
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;

    const topology = read(path);
    expect(topology).toContain('canvas.getContext("webgl"');
    expect(topology).not.toMatch(/style\s*=\s*\{/);
    expect(topology).not.toContain("dangerouslySetInnerHTML");
  });

  it("does not disturb the current Turnstile integration", () => {
    const auth = read("components/AuthForm.tsx");
    const turnstile = read("components/auth/TurnstileChallenge.tsx");

    expect(auth).toContain("Security verification");
    expect(auth).toContain("TurnstileChallenge");
    expect(turnstile).toContain("challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
  });
});
