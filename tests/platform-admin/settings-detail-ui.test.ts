import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("platform admin settings and detail UI", () => {
  it("groups settings into bounded operational sections", () => {
    const page = read("app/admin/settings/page.tsx");
    const form = read("components/platform-admin/PlatformSettingsForm.tsx");

    expect(page).toContain("adminSettingsGrid");
    expect(page).toContain("Provider-owned controls");
    expect(form).toContain("adminSettingsGroup");
    expect(form).toContain("adminSettingsSubmit");
  });

  it("uses responsive user detail and workspace membership views", () => {
    const page = read("app/admin/users/[userId]/page.tsx");

    expect(page).toContain("AdminPageHeader");
    expect(page).toContain("adminDesktopTable");
    expect(page).toContain("adminMobileCards");
    expect(page).toContain("adminDangerPanel");
  });
});
