import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const executorPath = path.resolve("packages/worker-supervisor/repository-scan.ts");
const supervisorPath = path.resolve("packages/worker-supervisor/supervisor.ts");

describe("Phase 6C prepared executor authority", () => {
  it("gives the repository scan executor only local prepared input and fixed sandbox configuration", async () => {
    const source = await readFile(executorPath, "utf8");
    expect(source).toContain("phase3_repository_scan_prepared");
    expect(source).toContain("sourceDirectory");
    expect(source).toContain("createPodmanSandbox");
    expect(source).toContain("podmanBinary");
    expect(source).toContain("scannerImage");
    expect(source).toContain("task.json");
    for (const forbidden of [
      "leaseToken",
      "X-Amz-",
      "cloudflarestorage.com",
      "createRepositoryScanArtifactAccess",
      "Supabase",
      "service_role",
      "github.com/",
      "child_process",
      "worker_threads",
      "packageManager",
      "runtime-observ",
      "active-validation",
      "model-provider",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("keeps signed artifact access in the supervisor preparation path and not in the executor contract", async () => {
    const source = await readFile(supervisorPath, "utf8");
    expect(source).toContain("repositoryScanArtifact");
    expect(source).toContain("repositoryScanPreparer");
    expect(source).toContain("phase3_repository_scan_no_egress_v1");
    expect(source).toContain("prepared.contract");
    expect(source).toContain("prepared.cleanup");
  });
});