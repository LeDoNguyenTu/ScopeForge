import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RUNNER_FILES = [
  "packages/hosted-scanner-runner/profile.ts",
  "packages/hosted-scanner-runner/run.ts",
  "packages/hosted-scanner-runner/container-entry.ts",
];

const FORBIDDEN = [
  "packages/cli",
  "loadScannerConfig",
  "node:child_process",
  "node:worker_threads",
  "node:vm",
  "node:http",
  "node:https",
  "node:net",
  "node:tls",
  "node:dns",
  "runtime-network",
  "repository-acquisition",
  "repository-snapshot/executor",
  "@supabase/",
  "supabase-js",
  "r2-",
  "model-providers",
  "globalThis.fetch",
];

describe("Phase 6C hosted scanner runner architecture", () => {
  it("cannot import execution, network, storage, database, CLI, or model authority", async () => {
    for (const relativePath of RUNNER_FILES) {
      const source = await readFile(path.resolve(relativePath), "utf8");
      for (const forbidden of FORBIDDEN) {
        expect(source, `${relativePath} must not contain ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("hard-disables remote OSV lookup in the fixed hosted profile", async () => {
    const source = await readFile(path.resolve("packages/hosted-scanner-runner/profile.ts"), "utf8");
    expect(source).toContain("createScaScanner({ osv: { enabled: false } })");
    expect(source).not.toMatch(/osv\s*:\s*\{\s*enabled\s*:\s*true/);
  });
});