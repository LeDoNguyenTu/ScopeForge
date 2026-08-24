import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadScannerConfig } from "@/packages/scanner-core/config/load-config";

const tempPaths: string[] = [];

async function tempDir(prefix: string) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("baseline configuration", () => {
  it("defaults baseline off and baseline policy scope to new findings", async () => {
    const root = await tempDir("scopeforge-baseline-config-default-");
    await expect(loadScannerConfig(root)).resolves.toMatchObject({
      baseline: undefined,
      baselineGate: "new"
    });
  });

  it("accepts a canonical relative baseline path and explicit all-finding gating", async () => {
    const root = await tempDir("scopeforge-baseline-config-valid-");
    await writeFile(
      join(root, ".scopeforge.json"),
      JSON.stringify({ version: 1, baseline: ".scopeforge-baseline.json", baselineGate: "all" })
    );

    await expect(loadScannerConfig(root)).resolves.toMatchObject({
      baseline: ".scopeforge-baseline.json",
      baselineGate: "all"
    });
  });

  it.each([
    "../baseline.json",
    "nested/../baseline.json",
    "./baseline.json",
    "nested\\baseline.json",
    "/tmp/baseline.json",
    ""
  ])("rejects unsafe repository baseline path %j", async (baseline) => {
    const root = await tempDir("scopeforge-baseline-config-path-");
    await writeFile(join(root, ".scopeforge.json"), JSON.stringify({ version: 1, baseline }));
    await expect(loadScannerConfig(root)).rejects.toMatchObject({ code: "invalid_config" });
  });

  it("rejects unknown baseline policy scope", async () => {
    const root = await tempDir("scopeforge-baseline-config-gate-");
    await writeFile(
      join(root, ".scopeforge.json"),
      JSON.stringify({ version: 1, baselineGate: "legacy-only" })
    );
    await expect(loadScannerConfig(root)).rejects.toMatchObject({ code: "invalid_config" });
  });
});
