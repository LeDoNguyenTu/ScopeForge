import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadScannerConfig } from "@/packages/scanner-core/config/load-config";
import { defaultInventoryBudgets } from "@/packages/scanner-core/inventory/types";

const tempPaths: string[] = [];
const fingerprintA = `sfs1:${"a".repeat(64)}`;
const fingerprintB = `sfs1:${"b".repeat(64)}`;

async function tempDir(prefix: string) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("loadScannerConfig", () => {
  it("returns secure defaults when the root has no configuration", async () => {
    const root = await tempDir("scopeforge-config-default-");

    await expect(loadScannerConfig(root)).resolves.toEqual({
      version: 1,
      sourcePath: null,
      scanners: null,
      rules: { include: [], exclude: [] },
      secrets: { allowFingerprints: [] },
      budgets: defaultInventoryBudgets,
      failOn: undefined,
      output: { format: "terminal", path: undefined }
    });
  });

  it("loads only the explicit root configuration and ignores nested config", async () => {
    const root = await tempDir("scopeforge-config-root-");
    await mkdir(join(root, "nested"), { recursive: true });
    await writeFile(
      join(root, ".scopeforge.json"),
      JSON.stringify({
        version: 1,
        scanners: ["secrets", "jsts"],
        rules: { include: ["jsts/eval"], exclude: ["jsts/info"] },
        secrets: { allowFingerprints: [fingerprintB, fingerprintA, fingerprintB] },
        budgets: { maxFiles: 100, maxFileBytes: 1024, maxTotalBytes: 4096 },
        failOn: "high",
        output: { format: "json", path: "reports/results.json" }
      })
    );
    await writeFile(join(root, "nested", ".scopeforge.json"), "{ invalid json");

    const config = await loadScannerConfig(root);

    expect(config.sourcePath).toBe(join(root, ".scopeforge.json"));
    expect(config.scanners).toEqual(["jsts", "secrets"]);
    expect(config.rules).toEqual({ include: ["jsts/eval"], exclude: ["jsts/info"] });
    expect(config.secrets).toEqual({ allowFingerprints: [fingerprintA, fingerprintB] });
    expect(config.budgets).toEqual({ maxFiles: 100, maxFileBytes: 1024, maxTotalBytes: 4096 });
    expect(config.failOn).toBe("high");
    expect(config.output).toEqual({ format: "json", path: "reports/results.json" });
  });

  it("rejects unknown keys and unsupported versions", async () => {
    const root = await tempDir("scopeforge-config-invalid-");
    await writeFile(join(root, ".scopeforge.json"), JSON.stringify({ version: 2, surprise: true }));

    await expect(loadScannerConfig(root)).rejects.toMatchObject({ code: "invalid_config" });
  });

  it("validates secret fingerprint allowlisting strictly", async () => {
    const root = await tempDir("scopeforge-config-secret-allowlist-");
    await writeFile(
      join(root, ".scopeforge.json"),
      JSON.stringify({ version: 1, secrets: { allowFingerprints: ["sfs1:not-a-valid-fingerprint"] } })
    );
    await expect(loadScannerConfig(root)).rejects.toMatchObject({ code: "invalid_config" });

    await writeFile(
      join(root, ".scopeforge.json"),
      JSON.stringify({ version: 1, secrets: { allowFingerprints: [fingerprintA], surprise: true } })
    );
    await expect(loadScannerConfig(root)).rejects.toMatchObject({ code: "invalid_config" });
  });

  it("does not allow repository config to raise safe inventory budgets", async () => {
    const root = await tempDir("scopeforge-config-budget-");
    await writeFile(
      join(root, ".scopeforge.json"),
      JSON.stringify({
        version: 1,
        budgets: { maxFiles: defaultInventoryBudgets.maxFiles + 1 }
      })
    );

    await expect(loadScannerConfig(root)).rejects.toMatchObject({ code: "unsafe_budget" });
  });

  it("rejects absolute and traversal output paths from repository configuration", async () => {
    const root = await tempDir("scopeforge-config-output-");

    await writeFile(
      join(root, ".scopeforge.json"),
      JSON.stringify({ version: 1, output: { format: "json", path: "../outside.json" } })
    );
    await expect(loadScannerConfig(root)).rejects.toMatchObject({ code: "invalid_config" });

    await writeFile(
      join(root, ".scopeforge.json"),
      JSON.stringify({ version: 1, output: { format: "json", path: join(root, "absolute.json") } })
    );
    await expect(loadScannerConfig(root)).rejects.toMatchObject({ code: "invalid_config" });
  });
});
