import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const executorPath = path.resolve(process.cwd(), "packages/worker-supervisor/repository-snapshot.ts");
const snapshotNetworkPath = path.resolve(process.cwd(), "packages/repository-snapshot-network/upload.ts");
const supervisorPath = path.resolve(process.cwd(), "packages/worker-supervisor/supervisor.ts");

describe("Phase 6B executor authority boundary", () => {
  it("forbids repository execution, scanners, Supabase, and raw or generic runtime-network authority", async () => {
    const source = await readFile(executorPath, "utf8");
    for (const forbidden of [
      "node:child_process",
      "node:worker_threads",
      "node:https",
      "node:http",
      "node:net",
      "node:tls",
      "node:dns",
      "child_process",
      "@supabase/",
      "lib/supabase",
      "scanner-coordinator",
      "runtime-observations",
      "active-validation",
      "packages/runtime-network",
      "package-manager",
      "model-provider",
      "openai",
      "anthropic",
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/\b(exec|execFile|spawn|fork)\s*\(/);
  });

  it("keeps the attempt PUT create-only inside the dedicated Phase 6B network boundary", async () => {
    const networkSource = await readFile(snapshotNetworkPath, "utf8");
    const executorSource = await readFile(executorPath, "utf8");

    expect(networkSource).toContain('"if-none-match": "*"');
    expect(networkSource).toContain('"content-type": "application/gzip"');
    expect(networkSource).toContain('from "node:https"');
    expect(executorSource).toContain("@/packages/repository-snapshot-network");
    expect(executorSource).not.toContain('from "node:https"');
  });

  it("keeps the supervisor provider-neutral and free of repository network/storage credentials", async () => {
    const source = await readFile(supervisorPath, "utf8");
    for (const forbidden of [
      "cloudflarestorage.com",
      "R2_SECRET_ACCESS_KEY",
      "api.github.com",
      "codeload.github.com",
      "@supabase/",
      "node:https",
      "node:dns",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
