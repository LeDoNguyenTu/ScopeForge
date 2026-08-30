import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routePath = path.resolve(
  "app/api/internal/workers/runtime/prepare/route.ts",
);
const preparationPath = path.resolve("lib/runtime-workers/preparation.ts");

describe("Phase 6D runtime preparation route", () => {
  it("uses normal worker credentials and derives worker identity outside the request body", async () => {
    const source = await readFile(routePath, "utf8");
    expect(source).toContain("authenticateWorkerRequest");
    expect(source).toContain("authenticateWorkerNode");
    expect(source).toContain("prepareRuntimeWorkerExecution");
    expect(source).toContain("worker.workerId");
    expect(source).not.toMatch(/createServerClient|auth\.getUser|getSession/);
  });

  it("accepts only exact lease identity fields and no caller-selected network authority", async () => {
    const source = await readFile(routePath, "utf8");
    expect(source).toContain('["taskId", "attemptId", "leaseToken"]');
    for (const forbidden of [
      "canonicalUrl",
      "hostname",
      "method",
      "headers",
      "body",
      "profile",
      "budget",
      "workspaceId",
      "assetId",
      "actorId",
      "origin",
      "userAgent",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("keeps preparation free of sockets, fetch, DNS, TLS, and mediator session creation", async () => {
    const [route, preparation] = await Promise.all([
      readFile(routePath, "utf8"),
      readFile(preparationPath, "utf8"),
    ]);
    const source = `${route}\n${preparation}`;
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/node:https|node:http|node:tls|node:dns|node:net/);
    expect(source).not.toMatch(/createMediatorSession|registerMediatorSession|runtime-network/);
  });
});
