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
    const navigation = await read("components/platform-admin/AdminNavigation.tsx");
    expect(layout).toContain("getPlatformAdminAccessState");
    expect(layout).toContain('access.status === "unauthenticated"');
    expect(layout).toContain('access.status === "denied"');
    expect(layout).not.toContain("requirePlatformAdmin");
    expect(layout).toContain("AdminNavigation");
    for (const label of ["Overview", "Users", "Workspaces", "Phase 11", "Providers", "Audit", "Settings", "Back to workspace"]) {
      expect(navigation).toContain(label);
    }
  });

  it("centers the active administration destination inside the mobile navigation rail", async () => {
    const navigation = await read("components/platform-admin/AdminNavigation.tsx");
    expect(navigation).toContain("activeLinkRef");
    expect(navigation).toContain("nav.scrollTo");
    expect(navigation).toContain("targetLeft");
    expect(navigation).toContain('aria-current={active ? "page" : undefined}');
  });

  it("keeps trusted Supabase credentials out of client admin components", async () => {
    const source = [
      await read("components/platform-admin/UserAdminControls.tsx"),
      await read("components/platform-admin/PlatformSettingsForm.tsx"),
      await read("components/platform-admin/AdminNavigation.tsx"),
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

  it("exposes provider readiness without enabling a provider from the UI", async () => {
    const page = await read("app/admin/providers/page.tsx");
    const readiness = await read("lib/provider-runtime/readiness.ts");
    expect(page).toContain("Provider runtime");
    expect(page).toContain("Fail closed by default");
    expect(page).toContain("Prepared does not mean enabled");
    expect(page).toContain("providerGateSummary");
    expect(page).toContain("Phase 12 capability expansion");
    expect(page).not.toContain("enableProvider");
    expect(page).not.toContain("Run provider");
    expect(readiness).toContain('enabled: false');
    expect(readiness).toContain('id: "linux"');
    expect(readiness).toContain('state: "pending"');
    expect(readiness).toContain('id: "control-plane"');
    expect(readiness).toContain('state: "locked"');
  });

  it("adds a server-confirmed platform admin entry to the normal dashboard", async () => {
    const dashboard = await read("app/dashboard/page.tsx");
    const shell = await read("components/AppShell.tsx");
    expect(dashboard).toContain("getOptionalPlatformAdmin");
    expect(dashboard).toContain("platformAdminHref");
    expect(shell).toContain("Platform admin");
  });
});
