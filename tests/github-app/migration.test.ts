import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260910160000_phase_10a1_github_connected_projects.sql",
);

describe("Phase 10A1 GitHub connected projects migration", () => {
  it("creates tenant-scoped connection and repository-link tables", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create table public.github_connections");
    expect(sql).toContain("create table public.github_repository_links");
    expect(sql).toContain("alter table public.github_connections enable row level security");
    expect(sql).toContain("alter table public.github_repository_links enable row level security");
    expect(sql).toMatch(/workspace_id\s+uuid\s+not null\s+unique/i);
    expect(sql).toMatch(/installation_id\s+bigint\s+not null\s+unique/i);
    expect(sql).toMatch(/unique\s*\(workspace_id,\s*repository_id\)/i);
    expect(sql).toMatch(/asset_id\s+uuid\s+not null\s+unique/i);
  });

  it("keeps repository and connection relationships inside the same workspace", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/unique\s*\(id,\s*workspace_id\)/i);
    expect(sql).toMatch(/foreign key\s*\(github_connection_id,\s*workspace_id\)[\s\S]*references public\.github_connections\s*\(id,\s*workspace_id\)/i);
    expect(sql).toMatch(/foreign key\s*\(asset_id,\s*workspace_id\)[\s\S]*references public\.assets\s*\(id,\s*workspace_id\)/i);
  });

  it("grants workspace members read-only browser visibility and no browser mutation authority", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const table of ["github_connections", "github_repository_links"]) {
      expect(sql).toMatch(new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i"));
      expect(sql).toMatch(new RegExp(`grant select on table public\\.${table} to authenticated`, "i"));
      expect(sql).not.toMatch(new RegExp(`grant\\s+(insert|update|delete)[^;]*public\\.${table}[^;]*authenticated`, "i"));
    }
    expect(sql).toMatch(/create policy github_connections_select_member[\s\S]*private\.is_workspace_member\(workspace_id\)/i);
    expect(sql).toMatch(/create policy github_repository_links_select_member[\s\S]*private\.is_workspace_member\(workspace_id\)/i);
  });

  it("bounds safe provider metadata and stores no GitHub credentials", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/repository_selection[\s\S]*'all'[\s\S]*'selected'/i);
    expect(sql).toMatch(/status[\s\S]*'active'[\s\S]*'suspended'[\s\S]*'removed'/i);
    expect(sql).toMatch(/access_status[\s\S]*'active'[\s\S]*'inaccessible'[\s\S]*'removed'/i);
    expect(sql).toMatch(/char_length\(trim\(account_login\)\)\s+between 1 and 100/i);
    expect(sql).toMatch(/char_length\(default_branch\)\s+between 1 and 255/i);
    expect(sql).toMatch(/html_url[\s\S]*https:\/\/github\.com\//i);

    for (const forbidden of [
      "client_secret",
      "private_key",
      "access_token",
      "oauth_token",
      "refresh_token",
      "credential",
    ]) {
      expect(sql.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("maintains update timestamps through the shared trusted trigger", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/create trigger github_connections_set_updated_at[\s\S]*private\.set_updated_at\(\)/i);
    expect(sql).toMatch(/create trigger github_repository_links_set_updated_at[\s\S]*private\.set_updated_at\(\)/i);
  });
});
