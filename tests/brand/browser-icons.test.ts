import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ScopeForge browser icons", () => {
  it("uses a dedicated versioned Forge Aperture icon URL for Safari tab identity", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");

    expect(layout).toContain("/scopeforge-mark-v2.svg");
    expect(layout).toContain('type: "image/svg+xml"');
    expect(layout).toContain("apple:");
    expect(existsSync("public/scopeforge-mark-v2.svg")).toBe(true);
  });

  it("publishes a web app manifest that uses the dedicated ScopeForge icon", () => {
    expect(existsSync("app/manifest.ts")).toBe(true);
    if (!existsSync("app/manifest.ts")) return;

    const manifest = readFileSync("app/manifest.ts", "utf8");
    expect(manifest).toContain("ScopeForge");
    expect(manifest).toContain("/scopeforge-mark-v2.svg");
    expect(manifest).toContain('purpose: "any maskable"');
  });
});
