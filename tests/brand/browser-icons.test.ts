import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ScopeForge browser icons", () => {
  it("provides explicit raster and ICO fallbacks for Safari and browser tabs", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");

    expect(layout).toContain("/favicon.ico");
    expect(layout).toContain("/apple-touch-icon.png");
    expect(layout).toContain("/icon-192.png");
    expect(existsSync("public/favicon.ico")).toBe(true);
    expect(existsSync("public/apple-touch-icon.png")).toBe(true);
    expect(existsSync("public/icon-192.png")).toBe(true);
    expect(existsSync("public/icon-512.png")).toBe(true);
  });

  it("publishes a web app manifest with installable ScopeForge icons", () => {
    expect(existsSync("app/manifest.ts")).toBe(true);
    if (!existsSync("app/manifest.ts")) return;

    const manifest = readFileSync("app/manifest.ts", "utf8");
    expect(manifest).toContain("ScopeForge");
    expect(manifest).toContain("/icon-192.png");
    expect(manifest).toContain("/icon-512.png");
    expect(manifest).toContain('purpose: "maskable"');
  });
});
