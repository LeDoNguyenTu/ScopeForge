import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routePath = path.resolve(process.cwd(), "app/api/internal/workers/runtime/finalize/route.ts");

describe("Phase 6D runtime finalize route", () => {
  it("derives worker identity from broker authentication and accepts only lease identity plus terminal", async () => {
    const source = await readFile(routePath, "utf8");
    expect(source).toContain("authenticateWorkerRequest");
    expect(source).toContain("publishRuntimeWorkerTerminal");
    expect(source).toContain('["taskId", "attemptId", "leaseToken", "terminal"]');
    expect(source).not.toContain("workerId: body");
    expect(source).not.toContain("workspaceId: body");
    expect(source).not.toContain("assetId: body");
    expect(source).not.toContain("url: body");
  });

  it("uses an explicit bounded terminal body ceiling and no generic worker finalizer", async () => {
    const source = await readFile(routePath, "utf8");
    expect(source).toContain("readBoundedWorkerJsonWithLimit");
    expect(source).toContain("196_608");
    expect(source).not.toContain("finalizeWorkerTask");
    expect(source).not.toContain("control.finalize");
  });

  it("keeps both Phase 6D classes explicit", async () => {
    const source = await readFile(routePath, "utf8");
    expect(source).toContain("passive_runtime_observation_v1");
    expect(source).toContain("active_cors_validation_v1");
  });
});
