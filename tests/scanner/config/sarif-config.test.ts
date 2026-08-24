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

describe("SARIF repository output configuration", () => {
  it("accepts SARIF as a root-configured output format", async () => {
    const root = await tempDir("scopeforge-sarif-config-");
    await writeFile(
      join(root, ".scopeforge.json"),
      JSON.stringify({ version: 1, output: { format: "sarif", path: "scopeforge.sarif" } })
    );

    const config = await loadScannerConfig(root);
    expect(config.output).toEqual({ format: "sarif", path: "scopeforge.sarif" });
  });

  it("keeps terminal as the default and rejects unknown formats", async () => {
    const root = await tempDir("scopeforge-sarif-config-invalid-");
    expect((await loadScannerConfig(root)).output.format).toBe("terminal");

    await writeFile(
      join(root, ".scopeforge.json"),
      JSON.stringify({ version: 1, output: { format: "sariff" } })
    );
    await expect(loadScannerConfig(root)).rejects.toMatchObject({ code: "invalid_config" });
  });
});
