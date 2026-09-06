import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error - benchmark fixture is intentionally authored as Node ESM JavaScript.
import {
  IAC_HEAVY_PROFILE,
  buildIacHeavyFixture,
} from "../../benchmarks/matrix/iac-heavy-fixture.mjs";

const roots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "scopeforge-iac-fixture-"));
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

async function snapshot(root: string): Promise<{ files: string[]; digest: string }> {
  const paths = await walkFiles(root);
  const hash = createHash("sha256");
  for (const path of paths) {
    hash.update(path, "utf8");
    hash.update("\0", "utf8");
    hash.update(await readFile(join(root, path)));
    hash.update("\0", "utf8");
  }
  return { files: paths, digest: hash.digest("hex") };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("iac-heavy-v1 fixture", () => {
  it("builds a deterministic 601-file four-family IaC fixture", async () => {
    const firstRoot = await tempRoot();
    const secondRoot = await tempRoot();
    await buildIacHeavyFixture(firstRoot);
    await buildIacHeavyFixture(secondRoot);

    const first = await snapshot(firstRoot);
    const second = await snapshot(secondRoot);
    expect(first.digest).toBe(second.digest);
    expect(first.files).toHaveLength(601);
    expect(first.files.filter((path) => path.startsWith("docker/") && path.includes("Dockerfile."))).toHaveLength(150);
    expect(first.files.filter((path) => path.startsWith("k8s/") && path.endsWith(".yaml"))).toHaveLength(150);
    expect(first.files.filter((path) => path.startsWith("terraform/") && path.endsWith(".tf"))).toHaveLength(150);
    expect(first.files.filter((path) => path.startsWith(".github/workflows/") && path.endsWith(".yml"))).toHaveLength(150);

    expect(IAC_HEAVY_PROFILE.id).toBe("iac-heavy-v1");
    expect(IAC_HEAVY_PROFILE.expectedFiles).toBe(601);
    expect(IAC_HEAVY_PROFILE.expectedFindingRuleCounts).toEqual({
      "iac/docker-floating-base-image": 1,
      "iac/github-actions-write-all-permissions": 1,
      "iac/kubernetes-privileged-container": 1,
      "iac/terraform-aws-public-rds": 1,
    });
    expect(IAC_HEAVY_PROFILE.maxWallMs).toBe(30_000);
  });

  it("pins execution to IaC and exactly the four benchmark rules", async () => {
    const root = await tempRoot();
    await buildIacHeavyFixture(root);
    const config = JSON.parse(await readFile(join(root, ".scopeforge.json"), "utf8"));
    expect(config).toEqual({
      version: 1,
      scanners: ["iac"],
      rules: {
        include: [
          "iac/docker-floating-base-image",
          "iac/github-actions-write-all-permissions",
          "iac/kubernetes-privileged-container",
          "iac/terraform-aws-public-rds",
        ],
      },
    });
  });
});
