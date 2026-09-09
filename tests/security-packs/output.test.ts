import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { formatTerminalResult } from "@/packages/cli/terminal";
import { serializeBaseline } from "@/packages/scanner-core/baseline/serialize";
import { runScan } from "@/packages/scanner-core/coordinator/run-scan";
import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { serializeHostedScanResult } from "@/packages/scanner-output/hosted/serialize";
import { serializeScanResult } from "@/packages/scanner-output/json/serialize";
import { serializeSarifResult } from "@/packages/scanner-output/sarif/serialize";
import {
  createSecurityPackScanner,
  loadSecurityPackRegistry,
} from "@/packages/security-packs";
import {
  cleanupTask5Roots,
  createTask5Pack,
  task5TemporaryRoot,
} from "./task5-helpers";

afterEach(cleanupTask5Roots);

async function scanPackFinding() {
  const packRoot = await createTask5Pack();
  const repositoryRoot = await task5TemporaryRoot("scopeforge-pack-output-repo-");
  await writeFile(
    join(repositoryRoot, "Dockerfile"),
    "FROM node:22\n# UNSAFE_SETTING=1\n",
  );

  const inventory = await buildRepositoryInventory(repositoryRoot);
  const registry = await loadSecurityPackRegistry([packRoot], {
    currentScopeForgeVersion: "0.1.0",
  });
  const result = await runScan({
    root: repositoryRoot,
    inventory,
    scanners: [createSecurityPackScanner(registry)],
  });

  expect(result.errors).toEqual([]);
  expect(result.findings).toHaveLength(1);
  return { packRoot, result };
}

describe("Security Pack output boundaries", () => {
  it("serializes ordinary local outputs deterministically without matcher or fixture source leakage", async () => {
    const { packRoot, result } = await scanPackFinding();
    const json = serializeScanResult(result, { toolVersion: "0.1.0" });
    const sarif = serializeSarifResult(result, { toolVersion: "0.1.0" });
    const terminal = formatTerminalResult(result);
    const baseline = serializeBaseline(result.findings, { toolVersion: "0.1.0" });

    const outputs = [json, sarif, terminal, baseline];
    for (const output of outputs) {
      expect(output).not.toContain("UNSAFE_SETTING=1");
      expect(output).not.toContain("scopeforge-reviewed-test-only");
      expect(output).not.toContain(packRoot);
    }

    expect(json).toBe(serializeScanResult(result, { toolVersion: "0.1.0" }));
    expect(sarif).toBe(serializeSarifResult(result, { toolVersion: "0.1.0" }));
    expect(sarif).toContain("pack/org.scopeforge.fixtures/config/unsafe-setting");
    expect(JSON.parse(json).findings[0].scanner).toBe("security-pack");
  });

  it("rejects Security Pack findings before hosted-json serialization", async () => {
    const { result } = await scanPackFinding();

    expect(() => serializeHostedScanResult(result, {
      toolVersion: "0.1.0",
      repositoryUrl: "https://github.com/example/repo",
    })).toThrow("Hosted ScopeForge export does not accept Security Pack findings.");
  });
});
