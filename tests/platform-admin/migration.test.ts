import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = path.join(root, "supabase/migrations/20260910020000_phase_10c_platform_admin.sql");

describe("Phase 10C platform administration migration", () => {
  it("creates an isolated platform administrator boundary", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create table public.platform_admins");
    expect(sql).toContain("create table public.platform_admin_audit_events");
    expect(sql).toContain("create table public.platform_settings");
    expect(sql).toContain("alter table public.platform_admins enable row level security");
    expect(sql).toContain("alter table public.platform_admin_audit_events enable row level security");
    expect(sql).toContain("alter table public.platform_settings enable row level security");
  });

  it("does not grant browser roles direct platform administration access", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/revoke all on table public\.platform_admins from public, anon, authenticated/i);
    expect(sql).toMatch(/revoke all on table public\.platform_admin_audit_events from public, anon, authenticated/i);
    expect(sql).toMatch(/revoke all on table public\.platform_settings from public, anon, authenticated/i);
    expect(sql).not.toMatch(/grant\s+(insert|update|delete).*platform_admins.*authenticated/i);
    expect(sql).not.toMatch(/grant\s+(insert|update|delete).*platform_settings.*authenticated/i);
  });

  it("keeps a singleton settings record and bounded audit fields", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/id\s+boolean\s+primary key\s+default true\s+check\s*\(id = true\)/i);
    expect(sql).toMatch(/char_length\((?:trim\()?reason\)?\)\s+between 1 and 500/i);
    expect(sql).toMatch(/pg_column_size\(metadata\) <= 8192/i);
    expect(sql).toContain("registration_enabled boolean not null default true");
    expect(sql).toContain("maintenance_mode boolean not null default false");
  });

  it("makes registration_disabled authoritative in the signup trigger", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create or replace function private.handle_new_user()");
    expect(sql).toMatch(/registration_enabled[\s\S]*REGISTRATION_DISABLED/i);
    expect(sql).toMatch(/revoke\s+all\s+on\s+function\s+private\.handle_new_user\s*\(\)/i);
  });
});
