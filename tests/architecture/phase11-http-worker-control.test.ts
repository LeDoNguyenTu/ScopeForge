import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function read(relativePath: string): Promise<string> {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Phase 11C HTTP worker control authority", () => {
  it("keeps queue and preparation free of direct database, process, and network authority", async () => {
    const source = [
      await read("lib/phase11-http-worker/queue.ts"),
      await read("lib/phase11-http-worker/preparation.ts"),
      await read("lib/phase11-http-worker/closed-parameters.ts"),
    ].join("\n");

    for (const forbidden of [
      /@supabase\//,
      /createClient\s*\(/,
      /service[_-]?role/i,
      /node:child_process/,
      /node:http/,
      /node:https/,
      /node:net/,
      /node:dns/,
      /\bfetch\s*\(/,
      /\bspawn\s*\(/,
      /\bexecFile\s*\(/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it("widens the generic worker claimant only after trusted persistence and finalization exist", async () => {
    const workerTypes = await read("packages/worker-contracts/types.ts");
    const globalUnion = workerTypes.match(/export type WorkerExecutionClass\s*=([\s\S]*?);/)?.[1] ?? "";
    expect(globalUnion).toContain("phase11_http_discovery_v1");

    const runtimeTaskContract = await read("packages/worker-runtime/task-contract.ts");
    expect(runtimeTaskContract).toContain('"phase11_http_discovery_v1"');

    const migration = await read("supabase/migrations/20260919010000_phase_11c_http_worker_control.sql");
    expect(migration).toContain("claim_phase11_http_worker_task");
    expect(migration).toContain("finalize_phase11_http_worker_attempt");
  });

  it("keeps hosted Phase 11 HTTP execution default-off after generic wiring", async () => {
    const environment = await read("docs/ENVIRONMENT.md");
    expect(environment).not.toContain("HOSTED_PHASE11_HTTP_DISCOVERY");
    expect(environment).not.toContain("PHASE11_HTTP_DISCOVERY_WORKER_ENABLED");
  });

  it("keeps claimed input identity-only", async () => {
    const workerTypes = await read("packages/worker-contracts/types.ts");
    const input = workerTypes.match(/export interface Phase11HttpDiscoveryInput \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(input).toContain('kind: "phase11_http_discovery"');
    expect(input).toContain("runId: string");
    expect(input).toContain("actionId: string");
    expect(input).toContain("authorizationId: string");
    expect(input).not.toMatch(/\b(url|hostname|path|headers|body|method|targetNodeId|providerArgs|networkPolicy|budget)\s*:/i);
  });
});
