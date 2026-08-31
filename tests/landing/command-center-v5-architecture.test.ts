import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const rendererFiles = [
  "components/landing/AttackSurfaceSceneV5.tsx",
  "components/landing/attack-surface-v5/model.ts",
  "components/landing/attack-surface-v5/quality.ts",
  "components/landing/attack-surface-v5/materials.ts",
  "components/landing/attack-surface-v5/geometry.ts",
  "components/landing/attack-surface-v5/lighting.ts",
  "components/landing/attack-surface-v5/effects.ts",
  "components/landing/attack-surface-v5/animation.ts",
  "components/landing/attack-surface-v5/controller.ts",
] as const;

describe("Command Center V5 architecture", () => {
  it("keeps a single active V5 visual path and no V4 runtime imports", () => {
    const layout = read("app/layout.tsx");
    const hero = read("components/landing/CommandCenterLandingHero.tsx");
    expect(layout).toContain("./command-center-v5.css");
    expect(layout).not.toContain("command-center-v4.css");
    expect(layout).not.toContain("command-center-v4-polish.css");
    expect(hero).toContain("CommandCenterHeroDesktopV5");
    expect(hero).toContain("CommandCenterHeroMobileV5");
    expect(hero).not.toMatch(/AttackSurfaceScene[\"']/);
  });

  it("keeps renderer modules presentation-only", () => {
    const forbidden = /@\/lib\/supabase|@supabase\/supabase-js|runtime-network|runtime-worker|scanner\/|canonical-evidence/i;
    for (const file of rendererFiles) {
      expect(read(file), file).not.toMatch(forbidden);
    }
  });
});
