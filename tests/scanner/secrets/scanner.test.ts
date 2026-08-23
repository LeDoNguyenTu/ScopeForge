import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { createSecretScanner } from "@/packages/scanner-secrets/scanner";

const tempPaths: string[] = [];
const githubToken = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-secrets-"));
  tempPaths.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("createSecretScanner", () => {
  it("scans only inventory entries through the local scanner interface", async () => {
    const root = await tempDir();
    await mkdir(join(root, "ignored"), { recursive: true });
    await writeFile(join(root, "app.ts"), `export const token = "${githubToken}";\n`);
    await writeFile(join(root, "ignored", "hidden.ts"), `const token = "${githubToken}";\n`);
    await writeFile(join(root, ".scopeforgeignore"), "ignored/**\n");

    const inventory = await buildRepositoryInventory(root);
    const scanner = createSecretScanner();
    const findings = await scanner.scan({ root, inventory });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.location.file).toBe("app.ts");
    expect(JSON.stringify(findings)).not.toContain(githubToken);
  });

  it("filters a finding by stable fingerprint allowlist", async () => {
    const root = await tempDir();
    await writeFile(join(root, "app.ts"), `export const token = "${githubToken}";\n`);
    const inventory = await buildRepositoryInventory(root);

    const first = await createSecretScanner().scan({ root, inventory });
    expect(first).toHaveLength(1);

    const allowed = await createSecretScanner({ allowFingerprints: [first[0]!.fingerprint] }).scan({ root, inventory });
    expect(allowed).toEqual([]);
  });
});
