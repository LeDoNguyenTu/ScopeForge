import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(path.resolve(root, directory), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.resolve(root, directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path.relative(root, target)));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(target);
  }
  return files;
}

async function joined(directory: string): Promise<string> {
  const files = await sourceFiles(directory);
  return (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
}

describe("Phase 6C authority architecture", () => {
  it("keeps the trusted snapshot stager outside acquisition and R2 PUT authority", async () => {
    const source = [
      await readFile(path.resolve(root, "packages/worker-supervisor/repository-scan-download.ts"), "utf8"),
      await readFile(path.resolve(root, "packages/worker-supervisor/repository-scan-stager.ts"), "utf8"),
    ].join("\n");
    expect(source).not.toMatch(/repository-acquisition|createAttemptUpload|createPresignedR2PutUrl|method:\s*["']PUT["']/);
    expect(source).not.toMatch(/github\.com|api\.github\.com|codeload\.github\.com/);
  });

  it("keeps acquisition workers outside hosted scanner and sandbox authority", async () => {
    const source = await joined("packages/repository-snapshot");
    expect(source).not.toMatch(/hosted-scanner-runner|worker-sandbox|podman|phase3_repository_scan_no_egress_v1/);
  });

  it("keeps browser and dashboard components outside worker, sandbox, stager, and object-store authority", async () => {
    const components = await joined("components");
    const dashboard = await joined("app/dashboard");
    const source = `${components}\n${dashboard}`;
    expect(source).not.toMatch(/worker-supervisor|worker-sandbox|repository-scan-stager|r2-signature-v4|createRepositorySnapshotObjectStore|secretAccessKey/);
  });

  it("keeps foundation execution outside scanner, GitHub, R2, and sandbox authority", async () => {
    const source = await readFile(path.resolve(root, "packages/worker-supervisor/foundation-probe.ts"), "utf8");
    expect(source).not.toMatch(/scanner-|github|r2-|worker-sandbox|podman|repository-snapshot/);
  });

  it("keeps Phase 6C product enablement explicitly closed in both UI and server action", async () => {
    const [panel, action] = await Promise.all([
      readFile(path.resolve(root, "components/assets/RepositoryScanPanel.tsx"), "utf8"),
      readFile(path.resolve(root, "app/dashboard/assets/[assetId]/scan-actions.ts"), "utf8"),
    ]);
    expect(panel).toContain("Runtime unavailable");
    expect(panel).toContain("disabled");
    expect(action).toContain("HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED = false");
    expect(action).toContain("REPOSITORY_SCAN_RUNTIME_UNAVAILABLE");
  });
});
