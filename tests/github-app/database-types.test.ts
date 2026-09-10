import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const typesPath = path.resolve("lib/database.phase10a1.types.ts");

describe("Phase 10A1 GitHub connected project database types", () => {
  it("types both public integration tables and their bounded states", async () => {
    const source = await readFile(typesPath, "utf8");
    expect(source).toContain("github_connections:");
    expect(source).toContain("github_repository_links:");
    expect(source).toContain('"active" | "suspended" | "removed"');
    expect(source).toContain('"all" | "selected"');
    expect(source).toContain('"active" | "inaccessible" | "removed"');
    expect(source).toContain('"User" | "Organization"');
  });

  it("includes safe repository metadata without credential fields", async () => {
    const source = await readFile(typesPath, "utf8");
    for (const column of [
      "installation_id",
      "account_id",
      "account_login",
      "repository_selection",
      "repository_id",
      "owner_login",
      "repository_name",
      "full_name",
      "default_branch",
      "is_private",
      "html_url",
      "auto_scan_enabled",
      "access_status",
    ]) {
      expect(source).toContain(column);
    }

    for (const forbidden of ["client_secret", "private_key", "access_token", "oauth_token", "refresh_token", "credential"]) {
      expect(source.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("types same-workspace relationships to connections and assets", async () => {
    const source = await readFile(typesPath, "utf8");
    expect(source).toContain('foreignKeyName: "github_repository_links_connection_workspace_fkey"');
    expect(source).toContain('columns: ["github_connection_id", "workspace_id"]');
    expect(source).toContain('referencedRelation: "github_connections"');
    expect(source).toContain('foreignKeyName: "github_repository_links_asset_workspace_fkey"');
    expect(source).toContain('columns: ["asset_id", "workspace_id"]');
    expect(source).toContain('referencedRelation: "assets"');
  });
});
