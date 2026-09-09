import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const rendererFiles = [
  "components/landing/CommandCenterSurface.tsx",
  "components/dashboard/WebGLAttackSurface.tsx",
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

describe("Command Center renderer architecture", () => {
  it("keeps the approved command-center path active without reviving V4 or the superseded split V5 hero", () => {
    const layout = read("app/layout.tsx");
    const hero = read("components/landing/CommandCenterLandingHero.tsx");

    expect(layout).toContain("./exact-command-center.css");
    expect(layout).not.toContain("command-center-v4.css");
    expect(layout).not.toContain("command-center-v4-polish.css");
    expect(hero).toContain('CommandCenterSurface from "@/components/landing/CommandCenterSurface"');
    expect(hero).toContain('className="commandHero"');
    expect(hero).not.toContain("CommandCenterHeroDesktopV5");
    expect(hero).not.toContain("CommandCenterHeroMobileV5");
    expect(hero).not.toMatch(/AttackSurfaceScene[\"']/);
  });

  it("keeps renderer modules presentation-only", () => {
    const forbidden = /@\/lib\/supabase|@supabase\/supabase-js|runtime-network|runtime-worker|scanner\/|canonical-evidence/i;
    for (const file of rendererFiles) {
      expect(read(file), file).not.toMatch(forbidden);
    }
  });
});
