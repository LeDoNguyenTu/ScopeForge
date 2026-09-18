import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routePath = path.resolve("app/api/internal/workers/phase11-http/finalize/route.ts");
const finalizationPath = path.resolve("lib/phase11-http-worker/finalization.ts");
const repositoryPath = path.resolve("lib/phase11-http-worker/finalization-context.ts");

describe("Phase 11 HTTP worker finalization route", () => {
  it("authenticates the dedicated worker and accepts only lease identity plus a terminal envelope", async () => {
    const source = await readFile(routePath, "utf8");
    expect(source).toContain("authenticateWorkerRequest");
    expect(source).toContain('worker.executionClass !== "phase11_http_discovery_v1"');
    expect(source).toContain('["taskId", "attemptId", "leaseToken", "terminal"]');
    expect(source).toContain("finalizeLeasedPhase11HttpWorker");
    for (const forbidden of ["workspaceId", "runId", "actionId", "authorizationId", "targetNodeId", "evidenceRef"]) {
      expect(source).not.toMatch(new RegExp(`["']${forbidden}["']`));
    }
  });

  it("keeps normalization and persistence behind the trusted finalization boundary", async () => {
    const [service, repository] = await Promise.all([
      readFile(finalizationPath, "utf8"),
      readFile(repositoryPath, "utf8"),
    ]);
    expect(service).toContain("validatePhase11HttpDiscoveryTerminalEnvelope");
    expect(service).toContain("createHttpDiscoveryProvider");
    expect(repository).toContain("get_phase11_http_worker_finalization_context");
    expect(repository).toContain("finalize_phase11_http_worker_attempt");
    expect(`${service}\n${repository}`).not.toMatch(/\bfetch\s*\(|node:https|node:http|node:tls|node:dns|node:net/);
  });
});
