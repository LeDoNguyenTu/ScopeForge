import { chmod, mkdir, rename, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadValidationCorpus } from "@/packages/validation-accuracy";
import {
  addRepositoryHardLink,
  addRepositorySymlink,
  vulnerableCase,
  validationRoot,
  writeCorpus,
} from "./task1-helpers";

describe("validation corpus parser security regressions", () => {
  it("rejects duplicate corpus JSON keys", async () => {
    const root = await validationRoot();
    await writeFile(
      join(root, "corpus.json"),
      '{"schemaVersion":1,"schemaVersion":1,"corpusId":"scopeforge-offline-v1","corpusVersion":"1.0.0","cases":[]}',
    );

    await expect(loadValidationCorpus(root)).rejects.toMatchObject({
      code: "VALIDATION_CORPUS_INVALID",
    });
  });

  it("rejects unknown corpus and case keys without reflecting hostile values", async () => {
    const corpusSentinel = "CORPUS_HOSTILE_SENTINEL";
    const corpusRoot = await writeCorpus([
      { directory: "cases/case-a", manifest: vulnerableCase("case-a") },
    ], { [corpusSentinel]: true });
    await expect(loadValidationCorpus(corpusRoot)).rejects.not.toThrow(corpusSentinel);
    await expect(loadValidationCorpus(corpusRoot)).rejects.toMatchObject({
      code: "VALIDATION_CORPUS_INVALID",
    });

    const caseSentinel = "CASE_HOSTILE_SENTINEL";
    const caseRoot = await writeCorpus([
      {
        directory: "cases/case-a",
        manifest: {
          ...vulnerableCase("case-a"),
          [caseSentinel]: true,
        },
      },
    ]);
    await expect(loadValidationCorpus(caseRoot)).rejects.not.toThrow(caseSentinel);
    await expect(loadValidationCorpus(caseRoot)).rejects.toMatchObject({
      code: "VALIDATION_CASE_INVALID",
    });
  });

  it("rejects non-UTF-8 case manifests", async () => {
    const root = await writeCorpus([
      { directory: "cases/case-a", manifest: vulnerableCase("case-a") },
    ]);
    await writeFile(join(root, "cases/case-a/case.json"), Buffer.from([0xff, 0xfe, 0xfd]));

    await expect(loadValidationCorpus(root)).rejects.toMatchObject({
      code: "VALIDATION_CASE_INVALID",
    });
  });

  it("rejects a symlinked corpus root", async () => {
    const root = await writeCorpus([
      { directory: "cases/case-a", manifest: vulnerableCase("case-a") },
    ]);
    const linkRoot = `${root}-link`;
    await symlink(root, linkRoot, "dir");

    await expect(loadValidationCorpus(linkRoot)).rejects.toMatchObject({
      code: "VALIDATION_PATH_INVALID",
    });
  });

  it("rejects symlinked repository files", async () => {
    const root = await writeCorpus([
      { directory: "cases/case-a", manifest: vulnerableCase("case-a") },
    ]);
    await addRepositorySymlink(root, "cases/case-a");

    await expect(loadValidationCorpus(root)).rejects.toMatchObject({
      code: "VALIDATION_REPOSITORY_UNSAFE",
    });
  });

  it("rejects hard-linked repository files", async () => {
    const root = await writeCorpus([
      { directory: "cases/case-a", manifest: vulnerableCase("case-a") },
    ]);
    await addRepositoryHardLink(root, "cases/case-a");

    await expect(loadValidationCorpus(root)).rejects.toMatchObject({
      code: "VALIDATION_REPOSITORY_UNSAFE",
    });
  });

  it("rejects repository file and total-byte ceilings", async () => {
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1, 0x61);
    const root = await writeCorpus([
      {
        directory: "cases/case-a",
        manifest: vulnerableCase("case-a"),
        files: { "src/app.ts": oversized },
      },
    ]);

    await expect(loadValidationCorpus(root)).rejects.toMatchObject({
      code: "VALIDATION_BUDGET_EXCEEDED",
    });
  });

  it("rejects case directories that escape the canonical corpus root", async () => {
    const root = await validationRoot();
    const outside = await validationRoot();
    await mkdir(join(outside, "repository/src"), { recursive: true });
    await writeFile(join(outside, "case.json"), JSON.stringify(vulnerableCase("case-a")));
    await writeFile(join(outside, "repository/src/app.ts"), "eval(input);\n");
    await mkdir(join(root, "cases"), { recursive: true });
    await symlink(outside, join(root, "cases/case-a"), "dir");
    await writeFile(join(root, "corpus.json"), JSON.stringify({
      schemaVersion: 1,
      corpusId: "scopeforge-offline-v1",
      corpusVersion: "1.0.0",
      cases: ["cases/case-a"],
    }));

    await expect(loadValidationCorpus(root)).rejects.toMatchObject({
      code: "VALIDATION_PATH_INVALID",
    });
  });
});
