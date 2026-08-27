import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routePath = path.resolve(
  "app/api/internal/workers/repository-scans/artifact/route.ts",
);

describe("Phase 6C artifact broker route", () => {
  it("authenticates the worker and accepts only exact lease identity fields", async () => {
    const source = await readFile(routePath, "utf8");

    expect(source).toContain("authenticateWorkerRequest");
    expect(source).toContain("readBoundedWorkerJson");
    expect(source).toContain('strictObject(await readBoundedWorkerJson(request), ["taskId", "attemptId", "leaseToken"])');
    expect(source).toContain("workerUuid(body.taskId)");
    expect(source).toContain("workerUuid(body.attemptId)");
    expect(source).toMatch(/\^\[a-f0-9\]\{64\}\$/);
    expect(source).toContain("createRepositoryScanArtifactAccess");
  });

  it("does not accept or return caller-selected storage/network authority", async () => {
    const source = await readFile(routePath, "utf8");

    for (const forbidden of [
      "objectKey",
      "bucket",
      "accountId",
      "accessKeyId",
      "secretAccessKey",
      "headers",
      "redirect",
      "method: body",
      "url: body",
      "snapshotId: body",
      "executionClass: body",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});