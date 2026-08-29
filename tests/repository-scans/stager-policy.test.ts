import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const downloadPath = path.resolve("packages/worker-supervisor/repository-scan-download.ts");
const stagerPath = path.resolve("packages/worker-supervisor/repository-scan-stager.ts");

describe("Phase 6C trusted staging architecture", () => {
  it("keeps repository networking in the trusted downloader and never follows redirects", async () => {
    const source = await readFile(downloadPath, "utf8");
    expect(source).toContain('method: "GET"');
    expect(source).toContain('redirect: "manual"');
    expect(source).toContain("expectedHost");
    expect(source).toContain("r2.cloudflarestorage.com");
    expect(source).toContain("content-length");
    expect(source).toContain('createHash("sha256")');
    expect(source).not.toContain("child_process");
    expect(source).not.toContain("worker_threads");
    expect(source).not.toContain("Supabase");
    expect(source).not.toContain("service_role");
  });

  it("uses the strict immutable bundle reader and never gives the sandbox a signed URL or lease", async () => {
    const source = await readFile(stagerPath, "utf8");
    expect(source).toContain("materializeRepositorySnapshotBundle");
    expect(source).toContain("downloadRepositoryScanArtifact");
    expect(source).toContain("storedArtifactBytes");
    expect(source).toContain("artifactDigest");
    expect(source).toContain("canonicalRepositoryUrl");
    expect(source).toContain("resolvedCommitSha");
    expect(source).toContain("contentDigest");
    for (const forbidden of [
      "leaseToken",
      "workerId",
      "service_role",
      "child_process",
      "worker_threads",
      "packageManager",
      "scanner-coordinator",
      "runtime-observ",
      "active-validation",
      "model-provider",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});