import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";

const tempPaths: string[] = [];

async function makeTempDir(prefix: string) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(
    tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  );
});

describe("buildRepositoryInventory", () => {
  it("excludes generated paths and root ignore patterns without following symlinks", async () => {
    const root = await makeTempDir("scopeforge-inventory-");
    const outside = await makeTempDir("scopeforge-outside-");

    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
    await mkdir(join(root, "ignored"), { recursive: true });
    await mkdir(join(root, "gitignored"), { recursive: true });

    await writeFile(join(root, "src", "index.ts"), "export const safe = true;\n");
    await writeFile(join(root, "node_modules", "pkg", "index.js"), "module.exports = {};\n");
    await writeFile(join(root, "ignored", "secret.txt"), "ignored\n");
    await writeFile(join(root, "gitignored", "cache.txt"), "ignored\n");
    await writeFile(join(root, "certificate.pem"), "placeholder\n");
    await writeFile(join(root, ".scopeforgeignore"), "ignored/**\n*.pem\n");
    await writeFile(join(root, ".gitignore"), "gitignored/**\n");
    await writeFile(join(outside, "outside.txt"), "do not follow\n");
    await symlink(join(outside, "outside.txt"), join(root, "external-link.txt"));

    const inventory = await buildRepositoryInventory(root);
    const paths = inventory.entries.map((entry) => entry.path);

    expect(paths).toContain("src/index.ts");
    expect(paths).not.toContain("node_modules/pkg/index.js");
    expect(paths).not.toContain("ignored/secret.txt");
    expect(paths).not.toContain("gitignored/cache.txt");
    expect(paths).not.toContain("certificate.pem");
    expect(paths).not.toContain("external-link.txt");
    expect(inventory.summary.skippedByReason.default_exclude).toBeGreaterThan(0);
    expect(inventory.summary.skippedByReason.scopeforgeignore).toBeGreaterThan(0);
    expect(inventory.summary.skippedByReason.gitignore).toBeGreaterThan(0);
    expect(inventory.summary.skippedByReason.symlink).toBeGreaterThan(0);
  });

  it("supports double-star patterns across zero or more directories", async () => {
    const root = await makeTempDir("scopeforge-double-star-");

    await mkdir(join(root, "foo", "nested"), { recursive: true });
    await mkdir(join(root, "certs"), { recursive: true });
    await writeFile(join(root, "foo", "bar.txt"), "direct\n");
    await writeFile(join(root, "foo", "nested", "bar.txt"), "nested\n");
    await writeFile(join(root, "root.pem"), "root certificate\n");
    await writeFile(join(root, "certs", "nested.pem"), "nested certificate\n");
    await writeFile(join(root, "keep.txt"), "keep\n");
    await writeFile(join(root, ".scopeforgeignore"), "foo/**/bar.txt\n**/*.pem\n");

    const inventory = await buildRepositoryInventory(root);
    const paths = inventory.entries.map((entry) => entry.path);

    expect(paths).toContain("keep.txt");
    expect(paths).not.toContain("foo/bar.txt");
    expect(paths).not.toContain("foo/nested/bar.txt");
    expect(paths).not.toContain("root.pem");
    expect(paths).not.toContain("certs/nested.pem");
  });

  it("enforces per-file and total scan budgets deterministically", async () => {
    const root = await makeTempDir("scopeforge-budget-");

    await writeFile(join(root, "a.txt"), "1234");
    await writeFile(join(root, "b.txt"), "5678");
    await writeFile(join(root, "large.txt"), "x".repeat(32));

    const inventory = await buildRepositoryInventory(root, {
      maxFiles: 10,
      maxFileBytes: 8,
      maxTotalBytes: 6
    });

    expect(inventory.entries.map((entry) => entry.path)).toEqual(["a.txt"]);
    expect(inventory.summary.skippedByReason.file_too_large).toBe(1);
    expect(inventory.summary.skippedByReason.total_bytes_limit).toBe(1);
  });

  it("stops traversing once the file-count budget is exhausted", async () => {
    const root = await makeTempDir("scopeforge-file-limit-");
    const outside = await makeTempDir("scopeforge-file-limit-outside-");

    await writeFile(join(root, "a.txt"), "a");
    await writeFile(join(root, "b.txt"), "b");
    await writeFile(join(root, "c.txt"), "c");
    await writeFile(join(outside, "outside.txt"), "outside");
    await symlink(join(outside, "outside.txt"), join(root, "z-link.txt"));

    const inventory = await buildRepositoryInventory(root, { maxFiles: 1 });

    expect(inventory.entries.map((entry) => entry.path)).toEqual(["a.txt"]);
    expect(inventory.summary.skippedByReason.file_limit).toBe(1);
    expect(inventory.summary.skippedByReason.symlink).toBe(0);
  });
});
