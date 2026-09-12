import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

async function read(relativePath: string): Promise<string> {
  return readFile(path.join(root, relativePath), "utf8");
}

describe("platform admin UI boundary", () => {
  it("protects the admin shell with platform authorization and exposes the required areas", async () => {
    const layout = await read("app/admin/layout.tsx");
    expect(layout).toContain("requirePlatformAdmin");
    for (const label of ["Overview", "Users", "Workspaces", "Audit", "Settings", "Back to workspace"]) {
      expect(layout).toContain(label);
    }
  });

  it("keeps trusted Supabase credentials out of client admin components", async () => {
    const source = [
      await read("components/platform-admin/UserAdminControls.tsx"),
      await read("components/platform-admin/PlatformSettingsForm.tsx"),
    ].join("\n");
    expect(source).not.toContain("SUPABASE_SECRET_KEY");
    expect(source).not.toContain("createAdminClient");
    expect(source).not.toContain("service_role");
  });

  it("provides user moderation, workspace visibility, audit history and site controls", async () => {
    const source = [
      await read("app/admin/users/[userId]/page.tsx"),
      await read("app/admin/workspaces/page.tsx"),
      await read("app/admin/audit/page.tsx"),
      await read("app/admin/settings/page.tsx"),
    ].join("\n");
    expect(source).toContain("UserAdminControls");
    expect(source).toContain("active findings");
    expect(source).toContain("Audit trail");
    expect(source).toContain("PlatformSettingsForm");
  });

  it("adds a server-confirmed platform admin entry to the normal dashboard", async () => {
    const dashboard = await read("app/dashboard/page.tsx");
    const shell = await read("components/AppShell.tsx");
    expect(dashboard).toContain("getOptionalPlatformAdmin");
    expect(dashboard).toContain("platformAdminHref");
    expect(shell).toContain("Platform admin");
  });
});
