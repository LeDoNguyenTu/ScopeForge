import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actionPath = path.resolve(
  process.cwd(),
  "app/dashboard/assets/[assetId]/runtime-actions.ts",
);

describe("passive runtime server action authority", () => {
  it("routes the hosted request through the closed Phase 6D request boundary", async () => {
    const source = await readFile(actionPath, "utf8");

    expect(source).toContain("requestPassiveRuntimeWorker");
    expect(source).not.toContain("executeRuntimeObservation");
    expect(source).not.toContain("enqueueRuntimeObservation");
    expect(source).toMatch(/runPassiveRuntimeObservation\(\s*assetId: string/);
    expect(source).not.toMatch(/export async function runPassiveRuntimeObservation\([^)]*(url|hostname|headers|method|profile|budget|worker|executionClass)/i);
    expect(source).not.toMatch(/runtime-network|node:https|node:tls|node:dns|\bfetch\s*\(/);
  });

  it("uses a separate cancellation action scoped by job id only", async () => {
    const source = await readFile(actionPath, "utf8");

    expect(source).toMatch(/cancelPassiveRuntimeObservation\(\s*jobId: string/);
    expect(source).toContain("requestRuntimeObservationCancellation");
  });
});
