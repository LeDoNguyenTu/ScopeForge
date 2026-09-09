import { rm } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { Scanner, ScannerRunResult } from "@/packages/scanner-core/coordinator/types";
import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import type { SecurityPackRegistry } from "@/packages/security-packs/registry";
import { loadSecurityPackRegistry } from "@/packages/security-packs/registry";
import { createSecurityPackScanner } from "@/packages/security-packs/scanner";
import {
  cleanupTask4Roots,
  createTask4Pack,
  createTask4Repository,
  task4Rule,
} from "./task4-helpers";

afterEach(cleanupTask4Roots);

async function runScanner(
  scanner: Scanner,
  root: string,
  inventory: Awaited<ReturnType<typeof buildRepositoryInventory>>,
): Promise<ScannerRunResult> {
  const result = await scanner.scan({ root, inventory });
  if (Array.isArray(result)) throw new Error("Security Pack scanner must return diagnostics with findings.");
  return result;
}

describe("Security Pack scanner adapter", () => {
  it("reads only candidate inventory entries and emits at most one finding per rule/file", async () => {
    const pack = await createTask4Pack("org.scan", [task4Rule("tls/disabled")]);
    const registry = await loadSecurityPackRegistry([pack], { currentScopeForgeVersion: "0.1.0" });
    const scanner = createSecurityPackScanner(registry);
    const root = await createTask4Repository({
      Dockerfile: "UNSAFE_SETTING=1\nUNSAFE_SETTING=1\n",
      "src/index.ts": "const marker = 'UNSAFE_SETTING=1';\n",
      "ignored.bin": Buffer.from([0, 1, 2, 3]),
    });
    const inventory = await buildRepositoryInventory(root);

    const result = await runScanner(scanner, root, inventory);

    expect(result.errors).toEqual([]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      scanner: "security-pack",
      ruleId: "pack/org.scan/tls/disabled",
      location: { file: "Dockerfile", startLine: 1, startColumn: 1 },
    });
  });

  it("returns a fixed privacy-safe diagnostic when an admitted candidate cannot be read safely", async () => {
    const pack = await createTask4Pack("org.read", [task4Rule("safe/read")]);
    const registry = await loadSecurityPackRegistry([pack], { currentScopeForgeVersion: "0.1.0" });
    const root = await createTask4Repository({
      Dockerfile: "RAW_SENTINEL_UNSAFE_SETTING=1\n",
    });
    const inventory = await buildRepositoryInventory(root);
    await rm(join(root, "Dockerfile"));

    const result = await runScanner(createSecurityPackScanner(registry), root, inventory);

    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([
      {
        code: "PACK_PATH_INVALID",
        file: "Dockerfile",
        message: "Pack candidate file could not be read safely.",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("RAW_SENTINEL");
  });

  it("enforces the per-pack finding ceiling even if an invalid registry object is injected", async () => {
    const pack = await createTask4Pack("org.limit", [task4Rule("limit/rule")]);
    const validRegistry = await loadSecurityPackRegistry([pack], { currentScopeForgeVersion: "0.1.0" });
    const syntheticRegistry = {
      ...validRegistry,
      rules: Object.freeze(Array.from({ length: 1001 }, () => validRegistry.rules[0]!)),
    } as SecurityPackRegistry;
    const root = await createTask4Repository({ Dockerfile: "UNSAFE_SETTING=1\n" });
    const inventory = await buildRepositoryInventory(root);

    const result = await runScanner(createSecurityPackScanner(syntheticRegistry), root, inventory);

    expect(result.errors).toContainEqual({
      code: "PACK_SCAN_LIMIT_EXCEEDED",
      message: "Security Pack finding limit was exceeded.",
    });
    expect(result.findings.length).toBeLessThanOrEqual(1000);
    expect(JSON.stringify(result)).not.toContain("UNSAFE_SETTING=1");
  });

  it("returns findings in the shared deterministic ordering", async () => {
    const pack = await createTask4Pack("org.order", [
      task4Rule("low/rule", { severity: "low", literal: "LOW_MARKER" }),
      task4Rule("critical/rule", { severity: "critical", literal: "CRITICAL_MARKER" }),
    ]);
    const registry = await loadSecurityPackRegistry([pack], { currentScopeForgeVersion: "0.1.0" });
    const root = await createTask4Repository({
      Dockerfile: "LOW_MARKER\nCRITICAL_MARKER\n",
    });
    const inventory = await buildRepositoryInventory(root);

    const result = await runScanner(createSecurityPackScanner(registry), root, inventory);

    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "pack/org.order/critical/rule",
      "pack/org.order/low/rule",
    ]);
  });
});
