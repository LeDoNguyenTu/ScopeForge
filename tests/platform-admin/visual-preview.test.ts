import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const previewPath = join(root, "app/preview/admin/page.tsx");

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("responsive admin visual acceptance fixture", () => {
  it("exists only as a preview/development synthetic surface", () => {
    const exists = existsSync(previewPath);
    expect(exists).toBe(true);
    if (!exists) return;

    const preview = read("app/preview/admin/page.tsx");
    expect(preview).toContain('process.env.VERCEL_ENV !== "preview"');
    expect(preview).toContain('process.env.NODE_ENV !== "development"');
    expect(preview).toContain("notFound()");
    expect(preview).toContain("AdminNavigation");
    expect(preview).toContain("GitHubRepositoryPicker");
    expect(preview).toContain("Sample data");
  });

  it("covers the representative admin and connected-project visual states", () => {
    if (!existsSync(previewPath)) return;
    const preview = read("app/preview/admin/page.tsx");
    for (const view of ["overview", "users", "workspaces", "audit", "settings", "github"]) {
      expect(preview).toContain(`"${view}"`);
    }
  });
});
