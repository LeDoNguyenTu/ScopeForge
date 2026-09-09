import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  readInventoryEntry,
  readInventoryEntryBytes,
} from "@/packages/scanner-core/filesystem/read-inventory-entry";
import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";

const tempPaths: string[] = [];

async function tempDir(prefix: string) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("readInventoryEntry", () => {
  it("reads only an entry present in the bounded inventory", async () => {
    const root = await tempDir("scopeforge-read-");
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "index.ts"), "export const value = 1;\n");
    await writeFile(join(root, "unlisted.txt"), "unlisted\n");

    const inventory = await buildRepositoryInventory(root);
    inventory.entries = inventory.entries.filter((entry) => entry.path !== "unlisted.txt");

    await expect(readInventoryEntry(inventory, "src/index.ts")).resolves.toBe(
      "export const value = 1;\n"
    );
    await expect(readInventoryEntry(inventory, "unlisted.txt")).rejects.toMatchObject({
      code: "not_in_inventory"
    });
  });

  it("returns identity-checked bytes without UTF-8 or line-ending normalization", async () => {
    const root = await tempDir("scopeforge-read-bytes-");
    const bytes = Buffer.from([0x61, 0x0d, 0x0a, 0xff, 0x62]);
    await writeFile(join(root, "bytes.bin"), bytes);

    const inventory = await buildRepositoryInventory(root);

    await expect(readInventoryEntryBytes(inventory, "bytes.bin")).resolves.toEqual(bytes);
  });

  it("rejects a file replaced by a symlink after inventory creation", async () => {
    const root = await tempDir("scopeforge-read-root-");
    const outside = await tempDir("scopeforge-read-outside-");
    const target = join(root, "target.txt");

    await writeFile(target, "safe\n");
    await writeFile(join(outside, "outside.txt"), "outside secret\n");
    const inventory = await buildRepositoryInventory(root);

    await rm(target);
    await symlink(join(outside, "outside.txt"), target);

    await expect(readInventoryEntry(inventory, "target.txt")).rejects.toMatchObject({
      code: "symlink"
    });
  });

  it("rechecks the size immediately before reading", async () => {
    const root = await tempDir("scopeforge-read-size-");
    const target = join(root, "target.txt");

    await writeFile(target, "ok");
    const inventory = await buildRepositoryInventory(root);
    await writeFile(target, "0123456789");

    await expect(
      readInventoryEntry(inventory, "target.txt", { maxFileBytes: 4 })
    ).rejects.toMatchObject({ code: "file_too_large" });
  });
});
