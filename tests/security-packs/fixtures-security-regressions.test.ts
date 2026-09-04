import { execFileSync } from "node:child_process";
import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validateSecurityPackFixtures } from "@/packages/security-packs/fixtures";
import { loadSecurityPackManifest } from "@/packages/security-packs/parse";
import {
  DEFAULT_TASK5_CASES,
  cleanupTask5Roots,
  createOutsideFile,
  createTask5Pack,
  replaceWithHardLink,
  replaceWithSymlink,
  writeTask5Case,
} from "./task5-helpers";

afterEach(cleanupTask5Roots);

async function expectFixtureBoundaryFailure(root: string) {
  const pack = await loadSecurityPackManifest(root);
  await expect(validateSecurityPackFixtures(pack)).rejects.toMatchObject({
    code: expect.stringMatching(/^PACK_(?:PATH|FIXTURE|BUDGET)/),
  });
}

describe("Security Pack hostile fixture boundaries", () => {
  it("rejects a fixture file symlink without modifying the outside target", async () => {
    const root = await createTask5Pack();
    const outside = await createOutsideFile("OUTSIDE_SYMLINK_SENTINEL\n");
    const original = await readFile(outside);
    await replaceWithSymlink(join(root, "fixtures", "positive", "repository", "Dockerfile"), outside);

    await expectFixtureBoundaryFailure(root);
    expect(await readFile(outside)).toEqual(original);
  });

  it("rejects a fixture hard link without modifying the outside target", async () => {
    const root = await createTask5Pack();
    const outside = await createOutsideFile("OUTSIDE_HARDLINK_SENTINEL\n");
    const original = await readFile(outside);
    await replaceWithHardLink(join(root, "fixtures", "positive", "repository", "Dockerfile"), outside);

    await expectFixtureBoundaryFailure(root);
    expect(await readFile(outside)).toEqual(original);
  });

  it("rejects a symlinked case.json without reflecting or modifying outside bytes", async () => {
    const root = await createTask5Pack();
    const outside = await createOutsideFile('{"RAW_CASE_SENTINEL":true}\n');
    const original = await readFile(outside);
    await replaceWithSymlink(join(root, "fixtures", "positive", "case.json"), outside);

    const rejection = await validateSecurityPackFixtures(await loadSecurityPackManifest(root))
      .catch((error: unknown) => error);
    expect(rejection).toMatchObject({ code: expect.stringMatching(/^PACK_(?:PATH|FIXTURE)/) });
    expect((rejection as Error).message).not.toContain("RAW_CASE_SENTINEL");
    expect(await readFile(outside)).toEqual(original);
  });

  it.each([
    ["nested pack manifest", "scopeforge-pack.json"],
    ["hidden git subtree", ".git/config"],
    ["hidden arbitrary subtree", ".cache/data"],
    ["node_modules subtree", "node_modules/pkg/index.js"],
    ["vendor subtree", "vendor/pkg/file.txt"],
  ])("rejects %s", async (_label, repositoryPath) => {
    const root = await createTask5Pack();
    const absolute = join(root, "fixtures", "positive", "repository", ...repositoryPath.split("/"));
    await mkdir(join(absolute, ".."), { recursive: true });
    await writeFile(absolute, "RAW_TREE_SENTINEL\n");

    const rejection = await validateSecurityPackFixtures(await loadSecurityPackManifest(root))
      .catch((error: unknown) => error);
    expect(rejection).toMatchObject({ code: expect.stringMatching(/^PACK_(?:PATH|FIXTURE)/) });
    expect((rejection as Error).message).not.toContain("RAW_TREE_SENTINEL");
  });

  it("rejects case-insensitive fixture path collisions", async () => {
    const root = await createTask5Pack();
    await writeFile(
      join(root, "fixtures", "positive", "repository", "dockerfile"),
      "SAFE_CASE_COLLISION\n",
    );

    await expectFixtureBoundaryFailure(root);
  });

  it("rejects traversal in expected finding paths without reflecting the hostile path", async () => {
    const root = await createTask5Pack();
    const casePath = join(root, "fixtures", "positive", "case.json");
    const parsed = JSON.parse(await readFile(casePath, "utf8"));
    parsed.expected = [{ file: "../RAW_TRAVERSAL_SENTINEL", startLine: 1, startColumn: 1 }];
    await writeFile(casePath, JSON.stringify(parsed));

    const rejection = await validateSecurityPackFixtures(await loadSecurityPackManifest(root))
      .catch((error: unknown) => error);
    expect(rejection).toMatchObject({ code: "PACK_FIXTURE_INVALID" });
    expect((rejection as Error).message).not.toContain("RAW_TRAVERSAL_SENTINEL");
  });

  it("rejects more than twenty cases for one rule before scanning fixtures", async () => {
    const root = await createTask5Pack();
    for (let index = 0; index < 18; index += 1) {
      await writeTask5Case(root, {
        caseId: `extra-${String(index).padStart(2, "0")}`,
        classification: "negative",
        expected: [],
        files: { Dockerfile: "SAFE_SETTING=1\n" },
      });
    }

    await expect(validateSecurityPackFixtures(await loadSecurityPackManifest(root)))
      .rejects.toMatchObject({ code: "PACK_BUDGET_EXCEEDED" });
  });

  it("rejects a fixture repository that exceeds the fixed byte budget", async () => {
    const root = await createTask5Pack();
    await writeFile(
      join(root, "fixtures", "positive", "repository", "large.bin"),
      Buffer.alloc(1024 * 1024 + 1, 0x41),
    );

    await expect(validateSecurityPackFixtures(await loadSecurityPackManifest(root)))
      .rejects.toMatchObject({ code: "PACK_BUDGET_EXCEEDED" });
  });

  it("rejects duplicate JSON keys and unknown case fields without hostile reflection", async () => {
    const duplicateRoot = await createTask5Pack();
    await writeFile(
      join(duplicateRoot, "fixtures", "positive", "case.json"),
      '{"schemaVersion":1,"schemaVersion":1,"caseId":"positive","ruleId":"config/unsafe-setting","classification":"positive","expected":[],"rationale":"RAW_DUPLICATE_SENTINEL"}',
    );
    const duplicate = await validateSecurityPackFixtures(await loadSecurityPackManifest(duplicateRoot))
      .catch((error: unknown) => error);
    expect(duplicate).toMatchObject({ code: "PACK_FIXTURE_INVALID" });
    expect((duplicate as Error).message).not.toContain("RAW_DUPLICATE_SENTINEL");

    const unknownRoot = await createTask5Pack();
    const casePath = join(unknownRoot, "fixtures", "positive", "case.json");
    const parsed = JSON.parse(await readFile(casePath, "utf8"));
    parsed.RAW_UNKNOWN_SENTINEL = true;
    await writeFile(casePath, JSON.stringify(parsed));
    const unknown = await validateSecurityPackFixtures(await loadSecurityPackManifest(unknownRoot))
      .catch((error: unknown) => error);
    expect(unknown).toMatchObject({ code: "PACK_FIXTURE_INVALID" });
    expect((unknown as Error).message).not.toContain("RAW_UNKNOWN_SENTINEL");
  });

  it.skipIf(process.platform === "win32")("rejects special files in fixture repositories", async () => {
    const root = await createTask5Pack();
    const fifo = join(root, "fixtures", "positive", "repository", "fixture.pipe");
    execFileSync("mkfifo", [fifo], { stdio: "ignore" });

    await expectFixtureBoundaryFailure(root);
    await rm(fifo, { force: true });
  });

  it("rejects case directory names that collide case-insensitively", async () => {
    const root = await createTask5Pack();
    const source = DEFAULT_TASK5_CASES[0]!;
    await writeTask5Case(root, { ...source, caseId: "Positive" });

    await expectFixtureBoundaryFailure(root);
  });
});
