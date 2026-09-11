import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260911143000_phase_10a1_service_role_table_acl_hardening.sql",
);

describe("Phase 10A1 service-role table ACL hardening", () => {
  it("removes legacy default table powers before granting only application-required privileges", async () => {
    const sql = (await readFile(migrationPath, "utf8")).replace(/\s+/g, " ").toLowerCase();

    for (const table of ["github_connections", "github_repository_links"]) {
      expect(sql).toContain(`revoke all on table public.${table} from service_role;`);
      expect(sql).toContain(`grant select, insert, update, delete on table public.${table} to service_role;`);
      expect(sql).not.toMatch(new RegExp(`grant[^;]*(truncate|references|trigger)[^;]*public\\.${table}[^;]*service_role`));
    }
  });
});
