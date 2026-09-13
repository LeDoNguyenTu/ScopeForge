import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("responsive platform admin shell", () => {
  it("delegates responsive navigation to a dedicated admin navigation component", () => {
    const layout = read("app/admin/layout.tsx");

    expect(layout).toContain('import AdminNavigation from "@/components/platform-admin/AdminNavigation"');
    expect(layout).toContain("<AdminNavigation");
    expect(layout).not.toContain("platformAdminNav\" aria-label=\"Platform administration");
  });

  it("does not use the legacy five wide horizontally scrolling mobile nav", () => {
    const css = read("app/admin/admin.css");

    expect(css).toContain(".platformAdminMobileNav");
    expect(css).not.toContain("grid-template-columns: repeat(5, minmax(0, 1fr))");
    expect(css).not.toContain("min-width: 110px");
  });

  it("keeps server-side platform authorization in the layout", () => {
    const layout = read("app/admin/layout.tsx");

    expect(layout).toContain("await requirePlatformAdmin()");
    expect(layout).toContain("PLATFORM_ADMIN_UNAUTHENTICATED");
  });
});
