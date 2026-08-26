import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

async function collect(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(target));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(target);
  }
  return files;
}

describe("Phase 6A worker authority boundaries", () => {
  it("keeps worker supervisor free of target-network and application service-role authority", async () => {
    const files = await collect(path.join(root, "packages/worker-supervisor"));
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, path.relative(root, file)).not.toMatch(
        /runtime-network|runtime-observer|runtime-validator|node:(?:http|https|net|dns|tls|dgram|child_process|worker_threads)|createAdminClient|@supabase\/|\bfetch\s*\(/,
      );
    }
  });

  it("keeps browser and component code away from worker supervisor modules", async () => {
    const files = [
      ...await collect(path.join(root, "components")),
      ...await collect(path.join(root, "app")),
    ];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, path.relative(root, file)).not.toMatch(/packages\/worker-supervisor/);
    }
  });

  it("keeps caller-facing worker DTOs free of arbitrary execution configuration", async () => {
    const files = [
      ...await collect(path.join(root, "lib/worker-control")),
      ...await collect(path.join(root, "app/api/internal/workers")),
    ];
    const joined = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
    for (const forbidden of [
      /\bcommand\b/i,
      /\bshell\b/i,
      /containerName/i,
      /networkAllowlist/i,
      /packageManager/i,
      /requestHeaders/i,
      /requestBody/i,
      /lifecycleState/i,
      /validationState/i,
    ]) {
      expect(joined).not.toMatch(forbidden);
    }
  });

  it("keeps service-role composition server-only", async () => {
    const serverDependencies = await readFile(
      path.join(root, "lib/worker-control/server-dependencies.ts"),
      "utf8",
    );
    expect(serverDependencies).toContain("createAdminClient");

    const browserFiles = [
      ...await collect(path.join(root, "components")),
      ...await collect(path.join(root, "app/api/internal/workers")),
    ];
    for (const file of browserFiles) {
      const source = await readFile(file, "utf8");
      expect(source, path.relative(root, file)).not.toContain("createAdminClient");
    }
  });

  it("does not route existing product scan executors through the Phase 6A worker path", async () => {
    const directories = [
      path.join(root, "lib/runtime-observations"),
      path.join(root, "lib/active-validation"),
      path.join(root, "lib/phase3-import"),
    ];
    for (const directory of directories) {
      const files = await collect(directory);
      for (const file of files) {
        const source = await readFile(file, "utf8");
        expect(source, path.relative(root, file)).not.toMatch(/worker-control|worker-supervisor|internal\/workers/);
      }
    }
  });

  it("keeps trial worker concurrency disabled in Phase 6A", async () => {
    const source = await readFile(path.join(root, "lib/quotas/limits.ts"), "utf8");
    expect(source).toContain("concurrentScanJobsPerWorkspace: 0");
  });
});
