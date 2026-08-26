import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const executorPath = path.resolve(process.cwd(), "packages/worker-supervisor/repository-snapshot.ts");
const supervisorPath = path.resolve(process.cwd(), "packages/worker-supervisor/supervisor.ts");

describe("Phase 6B executor authority boundary", () => {
  it("forbids repository execution, scanners, Supabase, and generic runtime-network authority", async () => {
    const source = await readFile(executorPath, "utf8");
    for (const forbidden of [
      "node:child_process",
      "node:worker_threads",
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

  it("requires the attempt PUT to be create-only at R2", async () => {
    const source = await readFile(executorPath, "utf8");
    expect(source).toContain('"if-none-match": "*"');
    expect(source).toContain('"content-type": "application/gzip"');
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
