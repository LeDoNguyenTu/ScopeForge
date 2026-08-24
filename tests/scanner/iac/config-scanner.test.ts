import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { createIacScanner } from "@/packages/scanner-iac/scanner";

const tempPaths: string[] = [];

async function tempDir(prefix: string) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("configuration scanner integration", () => {
  it("classifies and scans supported config files without scanning unrelated config", async () => {
    const root = await tempDir("scopeforge-config-iac-");
    await writeFile(join(root, ".npmrc"), "strict-ssl=false\n");
    await writeFile(
      join(root, "vercel.json"),
      JSON.stringify({ headers: [{ source: "/api", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }] })
    );
    await writeFile(join(root, "settings.json"), JSON.stringify({ strictSsl: false, cors: "*" }));

    const inventory = await buildRepositoryInventory(root);
    expect(inventory.entries.find((entry) => entry.path === ".npmrc")?.kind).toBe("config");
    expect(inventory.entries.find((entry) => entry.path === "vercel.json")?.kind).toBe("config");

    const result = await createIacScanner().scan({ root, inventory });
    expect(Array.isArray(result)).toBe(false);
    if (Array.isArray(result)) throw new Error("expected scanner result");

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => [finding.ruleId, finding.location.file])).toEqual([
      ["iac/config-npm-strict-ssl-disabled", ".npmrc"],
      ["iac/config-vercel-wildcard-cors", "vercel.json"]
    ]);
  });

  it("keeps config fingerprints stable when harmless lines move", async () => {
    const firstRoot = await tempDir("scopeforge-config-iac-first-");
    const secondRoot = await tempDir("scopeforge-config-iac-second-");
    await writeFile(join(firstRoot, ".npmrc"), "strict-ssl=false\n");
    await writeFile(join(secondRoot, ".npmrc"), "fund=true\n\nstrict-ssl=false\n");

    const firstInventory = await buildRepositoryInventory(firstRoot);
    const secondInventory = await buildRepositoryInventory(secondRoot);
    const first = await createIacScanner().scan({ root: firstRoot, inventory: firstInventory });
    const second = await createIacScanner().scan({ root: secondRoot, inventory: secondInventory });
    if (Array.isArray(first) || Array.isArray(second)) throw new Error("expected scanner results");

    expect(first.findings).toHaveLength(1);
    expect(second.findings).toHaveLength(1);
    expect(second.findings[0]?.fingerprint).toBe(first.findings[0]?.fingerprint);
    expect(second.findings[0]?.location.startLine).toBe(3);
  });
});
