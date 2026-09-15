import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const overlayPath = path.resolve(
  "supabase/migrations/20260912024000_phase_10a3_same_head_pending_recovery.sql",
);

describe("Phase 10A3 same-head pending recovery migration", () => {
  it("re-arms the newest same-head delivery when pending state has no active intent", async () => {
    expect(existsSync(overlayPath)).toBe(true);

    const sql = (await readFile(overlayPath, "utf8")).replace(/\s+/g, " ");
    const start = sql.indexOf("create or replace function public.record_github_webhook_push_head");
    expect(start).toBeGreaterThanOrEqual(0);
    const segment = sql.slice(start);

    expect(segment).toContain("pg_advisory_xact_lock");
    expect(segment).toContain("intent_record private.github_project_scan_intents%rowtype");
    expect(segment).toContain("already_active boolean := false");

    const intentLock = segment.indexOf("select * into intent_record");
    const activeAssignment = segment.indexOf("already_active := intent_record.id is not null and intent_record.state <> 'idle'");
    const replayDecision = segment.indexOf("if auto_record.desired_commit_sha = target_commit_sha and auto_record.pending and already_active then");

    expect(intentLock).toBeGreaterThanOrEqual(0);
    expect(activeAssignment).toBeGreaterThan(intentLock);
    expect(replayDecision).toBeGreaterThan(activeAssignment);

    expect(segment).toContain("'shouldEnqueue', true");
    expect(segment).toContain("'shouldEnqueue', not already_active");
    expect(segment).toMatch(/revoke all on function public\.record_github_webhook_push_head\([^;]+\) from public, anon, authenticated, service_role/);
    expect(segment).toMatch(/grant execute on function public\.record_github_webhook_push_head\([^;]+\) to service_role/);
  });
});
