import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(process.cwd(), "packages/repository-acquisition-network");

async function source(file: string): Promise<string> {
  return readFile(path.join(packageRoot, file), "utf8");
}

describe("Phase 6B acquisition network architecture", () => {
  it("does not reuse generic runtime, process, scanner, or model authority", async () => {
    const combined = [
      await source("types.ts"),
      await source("policy.ts"),
      await source("https-stream.ts"),
      await source("github-client.ts"),
      await source("index.ts"),
    ].join("\n");

    for (const forbidden of [
      "@/packages/runtime-network",
      "node:child_process",
      "node:worker_threads",
      "scanner-coordinator",
      "runtime-observations",
      "active-validation",
      "model-provider",
    ]) {
      expect(combined).not.toContain(forbidden);
    }
  });

  it("exports GitHub acquisition concepts rather than a generic requester", async () => {
    const index = await source("index.ts");
    expect(index).toContain("GitHubRepositoryAcquirer");
    expect(index).not.toMatch(/export .*requestPinned/i);
    expect(index).not.toMatch(/export .*https-stream/i);
  });
});
