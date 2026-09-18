import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routePath = path.resolve("app/api/internal/workers/phase11-http/prepare/route.ts");
const leasePreparationPath = path.resolve("lib/phase11-http-worker/leased-preparation.ts");
const contextPath = path.resolve("lib/phase11-http-worker/preparation-context.ts");

describe("Phase 11 HTTP worker preparation route", () => {
  it("authenticates the dedicated worker and accepts only exact lease identity", async () => {
    const source = await readFile(routePath, "utf8");
    expect(source).toContain("authenticateWorkerRequest");
    expect(source).toContain("authenticateWorkerNode");
    expect(source).toContain('worker.executionClass !== "phase11_http_discovery_v1"');
    expect(source).toContain('["taskId", "attemptId", "leaseToken"]');
    expect(source).toContain("prepareLeasedPhase11HttpWorker");
    for (const forbidden of [
      "workspaceId", "runId", "actionId", "authorizationId", "canonicalUrl",
      "hostname", "method", "headers", "body", "profile", "budget",
    ]) expect(source).not.toMatch(new RegExp(`["']${forbidden}["']`));
  });

  it("loads authority through the lease-bound service-role RPC", async () => {
    const [leased, context] = await Promise.all([
      readFile(leasePreparationPath, "utf8"),
      readFile(contextPath, "utf8"),
    ]);
    expect(context).toContain("get_phase11_http_worker_preparation_context");
    expect(leased).toContain("preparePhase11HttpWorker");
    expect(context).toContain("target_worker_id");
    expect(context).toContain("target_task_id");
    expect(context).toContain("target_attempt_id");
    expect(context).toContain("target_lease_token");
    expect(`${leased}\n${context}`).not.toMatch(/\.from\(|\bfetch\s*\(|node:https|node:http|node:tls|node:dns|node:net/);
  });
});
