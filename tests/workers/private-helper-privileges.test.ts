import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260826110900_phase_6a_worker_private_helper_privileges.sql",
);

describe("Phase 6A private worker helper privileges", () => {
  it("revokes direct execution of private worker helpers from application and service roles", async () => {
    const sql = await readFile(migrationPath, "utf8");

    for (const signature of [
      "private.record_worker_event(text, uuid, uuid, uuid, jsonb)",
      "private.recover_expired_unleased_worker_tasks(timestamptz)",
      "private.guard_worker_node_update()",
      "private.guard_worker_task_update()",
      "private.guard_worker_attempt_update()",
    ]) {
      expect(sql).toContain(`revoke all on function ${signature}`);
    }

    expect(sql.match(/from public, anon, authenticated, service_role;/g)?.length ?? 0).toBe(5);
    expect(sql).not.toMatch(/grant execute/i);
  });
});
