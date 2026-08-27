import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const panelPath = path.resolve("components/assets/RepositoryScanPanel.tsx");

describe("Phase 6C repository scan asset panel", () => {
  it("shows safe hosted scan provenance but keeps product enablement closed until runtime acceptance", async () => {
    const source = await readFile(panelPath, "utf8");
    expect(source).toContain("Hosted repository scan");
    expect(source).toContain("Runtime unavailable");
    expect(source).toContain("disabled");
    expect(source).toContain("rootless Podman");
    expect(source).toContain("scannerProfileId");
    expect(source).toContain("resolvedCommitSha");
    expect(source).toContain("findingCount");
  });

  it("never renders worker, lease, storage, container, local path, or source artifact authority", async () => {
    const source = await readFile(panelPath, "utf8");
    for (const forbidden of [
      "objectKey",
      "leaseToken",
      "workerId",
      "containerName",
      "sourceDirectory",
      "download.url",
      "secretAccessKey",
      "accessKeyId",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
