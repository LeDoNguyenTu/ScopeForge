import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error - benchmark fixture is intentionally authored as Node ESM JavaScript.
import { DEPENDENCY_COMPONENT_COUNT, DEPENDENCY_LOCKFILE_HEAVY_PROFILE, buildDependencyLockfileHeavyFixture } from "../../benchmarks/matrix/dependency-lockfile-heavy-fixture.mjs";

const roots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scopeforge-dependency-fixture-"));
  roots.push(root);
  return root;
}

async function walkFiles(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, absolute));
    else if (entry.isFile()) files.push(relative(root, absolute).replaceAll("\\", "/"));
  }
  return files;
}

async function snapshot(root: string): Promise<{ files: number; digest: string }> {
  const paths = await walkFiles(root);
  const hash = createHash("sha256");
  for (const path of paths) {
    hash.update(path, "utf8");
    hash.update("\0", "utf8");
    hash.update(await readFile(join(root, path)));
    hash.update("\0", "utf8");
  }
  return { files: paths.length, digest: hash.digest("hex") };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("dependency-lockfile-heavy-v1 fixture", () => {
  it("builds a deterministic three-file SCA-only fixture", async () => {
    const firstRoot = await tempRoot();
    const secondRoot = await tempRoot();

    await buildDependencyLockfileHeavyFixture(firstRoot);
    await buildDependencyLockfileHeavyFixture(secondRoot);

    const first = await snapshot(firstRoot);
    const second = await snapshot(secondRoot);
    expect(first.digest).toBe(second.digest);
    expect(first.files).toBe(3);

    expect(DEPENDENCY_COMPONENT_COUNT).toBe(5000);
    expect(DEPENDENCY_LOCKFILE_HEAVY_PROFILE.id).toBe("dependency-lockfile-heavy-v1");
    expect(DEPENDENCY_LOCKFILE_HEAVY_PROFILE.expectedFiles).toBe(3);
    expect(DEPENDENCY_LOCKFILE_HEAVY_PROFILE.expectedFindingRuleCounts).toEqual({});
    expect(DEPENDENCY_LOCKFILE_HEAVY_PROFILE.maxWallMs).toBe(20_000);
  });

  it("contains exactly 5,000 stable resolved package entries and disables OSV", async () => {
    const root = await tempRoot();
    await buildDependencyLockfileHeavyFixture(root);

    const config = JSON.parse(await readFile(join(root, ".scopeforge.json"), "utf8"));
    expect(config).toEqual({
      version: 1,
      scanners: ["sca"],
      sca: { osv: { enabled: false } },
    });

    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    expect(manifest).toEqual({
      name: "scopeforge-dependency-benchmark",
      version: "1.0.0",
      private: true,
    });

    const lockfile = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
    expect(lockfile.lockfileVersion).toBe(3);
    const packageEntries = Object.entries(lockfile.packages as Record<string, { version?: string }>);
    expect(packageEntries).toHaveLength(5001);
    expect(lockfile.packages[""]).toEqual({
      name: "scopeforge-dependency-benchmark",
      version: "1.0.0",
      dependencies: {},
    });

    for (let index = 0; index < DEPENDENCY_COMPONENT_COUNT; index += 1) {
      const name = `bench-package-${String(index).padStart(5, "0")}`;
      const location = `node_modules/${name}`;
      expect(lockfile.packages[location]).toEqual({
        version: `1.${index % 100}.${Math.floor(index / 100)}`,
      });
    }
  });
});
