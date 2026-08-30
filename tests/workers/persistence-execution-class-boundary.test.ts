import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryPath = path.resolve("lib/worker-control/repository.ts");

describe("worker persistence execution-class boundary", () => {
  it("keeps the pre-6D generic claim parser narrowed to the three persistence classes it actually understands", async () => {
    const source = await readFile(repositoryPath, "utf8");

    expect(source).toMatch(/type WorkerPersistenceExecutionClass\s*=\s*[\s\S]*?"foundation_no_egress_v1"[\s\S]*?"repository_snapshot_github_public_v1"[\s\S]*?"phase3_repository_scan_no_egress_v1"/);
    expect(source).toMatch(/function parseExecutionClass\(value: unknown\): WorkerPersistenceExecutionClass/);
    expect(source).not.toMatch(/type WorkerPersistenceExecutionClass\s*=[\s\S]*?passive_runtime_observation_v1/);
    expect(source).not.toMatch(/type WorkerPersistenceExecutionClass\s*=[\s\S]*?active_cors_validation_v1/);
  });
});
