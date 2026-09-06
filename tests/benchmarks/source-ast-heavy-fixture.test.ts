import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error - benchmark fixture is intentionally authored as Node ESM JavaScript.
import { SOURCE_AST_HEAVY_PROFILE, buildSourceAstHeavyFixture } from "../../benchmarks/matrix/source-ast-heavy-fixture.mjs";

const roots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scopeforge-source-ast-fixture-"));
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

describe("source-ast-heavy-v1 fixture", () => {
  it("builds a deterministic 1,201-file JSTS-only fixture", async () => {
    const firstRoot = await tempRoot();
    const secondRoot = await tempRoot();

    await buildSourceAstHeavyFixture(firstRoot);
    await buildSourceAstHeavyFixture(secondRoot);

    const first = await snapshot(firstRoot);
    const second = await snapshot(secondRoot);

    expect(first.digest).toBe(second.digest);
    expect(first.files).toBe(1201);
    expect(SOURCE_AST_HEAVY_PROFILE.id).toBe("source-ast-heavy-v1");
    expect(SOURCE_AST_HEAVY_PROFILE.expectedFiles).toBe(1201);
    expect(SOURCE_AST_HEAVY_PROFILE.expectedFindingRuleCounts).toEqual({
      "jsts/dynamic-code-execution": 4,
    });
    expect(SOURCE_AST_HEAVY_PROFILE.maxWallMs).toBe(30_000);
  });

  it("pins the benchmark to only the intended JSTS rule", async () => {
    const root = await tempRoot();
    await buildSourceAstHeavyFixture(root);

    const config = JSON.parse(await readFile(join(root, ".scopeforge.json"), "utf8"));
    expect(config.version).toBe(1);
    expect(config.scanners).toEqual(["jsts"]);
    expect(config.rules?.include).toEqual(["jsts/dynamic-code-execution"]);
    expect(config.sca).toBeUndefined();
  });
});
