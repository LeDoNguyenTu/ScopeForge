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
  it("keeps worker supervisor free of application service-role and product runtime authority", async () => {
    const files = await collect(path.join(root, "packages/worker-supervisor"));
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, path.relative(root, file)).not.toMatch(
        /runtime-network|runtime-observer|runtime-validator|createAdminClient|@supabase\//,
      );
    }
  });

  it("keeps the Phase 6A foundation executor zero-egress and process-free", async () => {
    const source = await readFile(
      path.join(root, "packages/worker-supervisor/foundation-probe.ts"),
      "utf8",
    );
    expect(source).not.toMatch(
      /node:(?:http|https|net|dns|tls|dgram|child_process|worker_threads)|\bfetch\s*\(/,
    );
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
      /\bcommand\s*[:?]/i,
      /\bshell\s*[:?]/i,
      /\bcontainerName\s*[:?]/i,
      /\bnetworkAllowlist\s*[:?]/i,
      /\bpackageManager\s*[:?]/i,
      /\brequestHeaders\s*[:?]/i,
      /\brequestBody\s*[:?]/i,
      /\blifecycleState\s*[:?]/i,
      /\bvalidationState\s*[:?]/i,
    ]) {
      expect(joined).not.toMatch(forbidden);
    }
  });

  it("keeps service-role composition out of client-executed modules", async () => {
    const serverDependencies = await readFile(
      path.join(root, "lib/worker-control/server-dependencies.ts"),
      "utf8",
    );
    expect(serverDependencies).toContain("createAdminClient");

    const candidateFiles = [
      ...await collect(path.join(root, "components")),
      ...await collect(path.join(root, "app")),
    ];
    for (const file of candidateFiles) {
      const source = await readFile(file, "utf8");
      if (!/^[\s\S]*?["']use client["'];/.test(source)) continue;
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
