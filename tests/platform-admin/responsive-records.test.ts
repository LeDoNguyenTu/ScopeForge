import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const pages = [
  "app/admin/users/page.tsx",
  "app/admin/workspaces/page.tsx",
  "app/admin/audit/page.tsx",
];

describe("responsive admin records", () => {
  it("renders desktop tables and dedicated mobile cards from the same server results", () => {
    for (const path of pages) {
      const source = read(path);
      expect(source).toContain("adminDesktopTable");
      expect(source).toContain("adminMobileCards");
      expect(source).toContain("adminMobileCard");
    }
  });

  it("switches record representations instead of forcing desktop tables on phones", () => {
    const css = read("app/admin/admin-responsive.css");
    expect(css).toContain(".adminMobileCards { display: none;");
    expect(css).toContain(".adminDesktopTable { display: none;");
    expect(css).toContain(".adminMobileCards { display: grid;");
  });
});
