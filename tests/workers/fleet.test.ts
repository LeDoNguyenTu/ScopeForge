import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260826110300_phase_6a_worker_fleet_read.sql",
);
const fleetPath = path.resolve(process.cwd(), "lib/worker-control/fleet.ts");

describe("Phase 6A worker fleet read model", () => {
  it("exposes one bounded service-role-only fleet snapshot RPC", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("create or replace function public.get_worker_fleet_snapshot");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("limit 100");
    expect(sql).toMatch(/revoke all on function public\.get_worker_fleet_snapshot\(\) from public, anon, authenticated;/i);
    expect(sql).toMatch(/grant execute on function public\.get_worker_fleet_snapshot\(\) to service_role;/i);
  });

  it("does not expose credentials, leases, terminal payloads, or repository data", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const forbidden of [
      /credential_hash/i,
      /lease_token_hash/i,
      /leaseToken/i,
      /terminal_payload_digest/i,
      /stdout/i,
      /stderr/i,
      /repository/i,
      /environment/i,
    ]) {
      expect(sql).not.toMatch(forbidden);
    }
  });

  it("keeps the trusted fleet adapter bounded and RPC-only", async () => {
    const source = await readFile(fleetPath, "utf8");
    expect(source).toContain("repository.fleetSnapshot()");
    expect(source).not.toMatch(/\.from\(["']worker_/);
    expect(source).not.toMatch(/credential|leaseToken|terminalPayload|repositoryContent|environment/i);
  });
});
