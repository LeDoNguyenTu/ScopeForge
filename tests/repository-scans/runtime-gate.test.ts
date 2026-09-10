import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("hosted repository runtime gates", () => {
  it("uses shared default-off server capability configuration for snapshots", async () => {
    const source = await readFile(path.join(root, "lib/repository-snapshots/runtime.ts"), "utf8");
    expect(source).toContain("serverCapabilityEnabled");
    expect(source).not.toMatch(/HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED\s*=\s*false/);
  });

  it("does not hard-code the hosted repository scan gate inside the server action", async () => {
    const source = await readFile(path.join(root, "app/dashboard/assets/[assetId]/scan-actions.ts"), "utf8");
    expect(source).toContain("@/lib/repository-scans/runtime");
    expect(source).not.toMatch(/const\s+HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED\s*=\s*false/);
  });
});
