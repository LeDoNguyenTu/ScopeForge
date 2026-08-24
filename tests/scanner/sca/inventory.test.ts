import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { collectNpmDependencies } from "@/packages/scanner-sca/inventory";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-sca-inventory-"));
  tempPaths.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("collectNpmDependencies", () => {
  it("uses one highest-priority supported lockfile per directory and falls back independently", async () => {
    const root = await tempDir();
    await mkdir(join(root, "packages", "api"), { recursive: true });
    await mkdir(join(root, "packages", "web"), { recursive: true });

    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ dependencies: { manifestOnly: "1.0.0" } })
    );
    await writeFile(
      join(root, "package-lock.json"),
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "": { dependencies: { fromLock: "2.0.0" } },
          "node_modules/fromLock": { version: "2.0.0" }
        }
      })
    );
    await writeFile(
      join(root, "npm-shrinkwrap.json"),
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "": { dependencies: { shrinkwrapWins: "3.0.0" } },
          "node_modules/shrinkwrapWins": { version: "3.0.0" }
        }
      })
    );

    await writeFile(
      join(root, "packages", "api", "package.json"),
      JSON.stringify({ dependencies: { apiOnly: "4.0.0" } })
    );
    await writeFile(
      join(root, "packages", "web", "package.json"),
      JSON.stringify({ dependencies: { webOnly: "5.0.0" } })
    );
    await writeFile(
      join(root, "packages", "web", "yarn.lock"),
      ['webResolved@^5.0.0:', '  version "5.1.0"'].join("\n")
    );

    const inventory = await buildRepositoryInventory(root);
    const result = await collectNpmDependencies(inventory);

    expect(result.errors).toEqual([]);
    expect(result.components.map(({ name, version, sourceFile }) => ({ name, version, sourceFile }))).toEqual([
      { name: "shrinkwrapWins", version: "3.0.0", sourceFile: "npm-shrinkwrap.json" },
      { name: "apiOnly", version: "4.0.0", sourceFile: "packages/api/package.json" },
      { name: "webResolved", version: "5.1.0", sourceFile: "packages/web/yarn.lock" }
    ]);
  });

  it("returns parse diagnostics instead of silently treating malformed lockfiles as empty", async () => {
    const root = await tempDir();
    await writeFile(join(root, "package-lock.json"), "{ malformed");

    const inventory = await buildRepositoryInventory(root);
    const result = await collectNpmDependencies(inventory);

    expect(result.components).toEqual([]);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "invalid_lockfile", file: "package-lock.json" })
    ]);
  });
});
