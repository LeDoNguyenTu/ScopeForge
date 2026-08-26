import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const claimPath = path.resolve(process.cwd(), "app/api/internal/workers/claim/route.ts");
const finalizePath = path.resolve(process.cwd(), "app/api/internal/workers/finalize/route.ts");

describe("Phase 6B worker broker", () => {
  it("keeps repository claim body-free and prevents raw object-key transport", async () => {
    const source = await readFile(claimPath, "utf8");
    expect(source).toContain("assertNoWorkerRequestBody");
    expect(source).toContain("claimWorkerTask");
    expect(source).not.toContain("artifactObjectKey");
    expect(source).not.toContain("repository-source/");
    expect(source).not.toContain("R2_SECRET_ACCESS_KEY");
  });

  it("routes successful repository terminals through dedicated publication", async () => {
    const source = await readFile(finalizePath, "utf8");
    expect(source).toContain("publishRepositorySnapshotAttempt");
    expect(source).toContain("createRepositorySnapshotServerDependencies");
    expect(source).toContain("repository_snapshot_github_public_v1");
    expect(source).toContain('body.terminal');
    expect(source).toContain("finalizeWorkerAttempt");
  });

  it("does not accept private locators or new authority fields outside the terminal envelope", async () => {
    const source = await readFile(finalizePath, "utf8");
    expect(source).toContain('strictObject(await readBoundedWorkerJson(request), ["leaseToken", "terminal"])');
    for (const forbidden of [
      "artifactObjectKey",
      "bucket",
      "objectKey",
      "command",
      "networkPolicy",
      "headers",
      "repositoryUrl",
      "branch",
      "commitSha",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
