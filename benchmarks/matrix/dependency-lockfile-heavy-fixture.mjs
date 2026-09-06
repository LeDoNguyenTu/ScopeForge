import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

export const DEPENDENCY_COMPONENT_COUNT = 5000;
const PROFILE_ID = "dependency-lockfile-heavy-v1";
const MAX_LOCKFILE_BYTES = 2 * 1024 * 1024;

async function write(root, relativePath, content) {
  const destination = join(root, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
}

function buildPackages() {
  const packages = {
    "": {
      name: "scopeforge-dependency-benchmark",
      version: "1.0.0",
      dependencies: {},
    },
  };

  for (let index = 0; index < DEPENDENCY_COMPONENT_COUNT; index += 1) {
    const name = `bench-package-${String(index).padStart(5, "0")}`;
    packages[`node_modules/${name}`] = {
      version: `1.${index % 100}.${Math.floor(index / 100)}`,
    };
  }
  return packages;
}

export async function buildDependencyLockfileHeavyFixture(root) {
  await write(
    root,
    ".scopeforge.json",
    `${JSON.stringify(
      {
        version: 1,
        scanners: ["sca"],
        sca: { osv: { enabled: false } },
      },
      null,
      2,
    )}\n`,
  );

  await write(
    root,
    "package.json",
    `${JSON.stringify(
      {
        name: "scopeforge-dependency-benchmark",
        version: "1.0.0",
        private: true,
      },
      null,
      2,
    )}\n`,
  );

  const serializedLockfile = `${JSON.stringify(
    {
      name: "scopeforge-dependency-benchmark",
      version: "1.0.0",
      lockfileVersion: 3,
      requires: true,
      packages: buildPackages(),
    },
    null,
    2,
  )}\n`;

  if (Buffer.byteLength(serializedLockfile, "utf8") >= MAX_LOCKFILE_BYTES) {
    throw new Error(`benchmark ${PROFILE_ID} lockfile exceeds the fixed file-size budget`);
  }
  await write(root, "package-lock.json", serializedLockfile);
}

async function preflightDependencyInventory(root) {
  const { buildRepositoryInventory } = require(
    "../../.scopeforge-build/packages/scanner-core/inventory/build-inventory.js",
  );
  const { collectNpmDependencies } = require(
    "../../.scopeforge-build/packages/scanner-sca/inventory.js",
  );

  const inventory = await buildRepositoryInventory(root);
  const result = await collectNpmDependencies(inventory);
  const valid =
    inventory.summary.filesAnalyzed === 3 &&
    result.errors.length === 0 &&
    result.components.length === DEPENDENCY_COMPONENT_COUNT &&
    result.components.every(
      (component) => component.sourceFile === "package-lock.json" && component.certainty === "resolved",
    );

  if (!valid) {
    throw new Error(`benchmark ${PROFILE_ID} dependency preflight contract changed`);
  }
}

export const DEPENDENCY_LOCKFILE_HEAVY_PROFILE = Object.freeze({
  id: PROFILE_ID,
  expectedFiles: 3,
  expectedFindingRuleCounts: Object.freeze({}),
  maxWallMs: 20_000,
  buildFixture: buildDependencyLockfileHeavyFixture,
  preflight: preflightDependencyInventory,
});
