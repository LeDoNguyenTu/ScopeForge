import { describe, expect, it } from "vitest";

import { loadValidationCorpus } from "@/packages/validation-accuracy";
import {
  cleanCase,
  vulnerableCase,
  writeCorpus,
} from "./task1-helpers";

describe("validation corpus parser", () => {
  it("loads one exact corpus, computes identity, and deeply freezes it", async () => {
    const loaded = await loadValidationCorpus(await writeCorpus([
      {
        directory: "cases/case-a",
        manifest: vulnerableCase("case-a"),
      },
    ]));

    expect(loaded.manifest.corpusId).toBe("scopeforge-offline-v1");
    expect(loaded.manifest.corpusVersion).toBe("1.0.0");
    expect(loaded.cases).toHaveLength(1);
    expect(loaded.contentHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded.manifest)).toBe(true);
    expect(Object.isFrozen(loaded.manifest.cases)).toBe(true);
    expect(Object.isFrozen(loaded.cases)).toBe(true);
    expect(Object.isFrozen(loaded.cases[0]?.manifest)).toBe(true);
    expect(Object.isFrozen(loaded.cases[0]?.manifest.expectedFiles)).toBe(true);
  });

  it.each([
    "../case-a",
    "/case-a",
    "C:/case-a",
    "cases\\case-a",
    "cases//case-a",
    "cases/./case-a",
  ])("rejects unsafe case reference %s", async (casePath) => {
    const root = await writeCorpus([
      { directory: "cases/case-a", manifest: vulnerableCase("case-a") },
    ], { cases: [casePath] });

    await expect(loadValidationCorpus(root)).rejects.toMatchObject({
      code: "VALIDATION_PATH_INVALID",
    });
  });

  it("rejects duplicate case paths", async () => {
    const root = await writeCorpus([
      { directory: "cases/case-a", manifest: vulnerableCase("case-a") },
    ], { cases: ["cases/case-a", "cases/case-a"] });

    await expect(loadValidationCorpus(root)).rejects.toMatchObject({
      code: "VALIDATION_CORPUS_INVALID",
    });
  });

  it("rejects duplicate case IDs even when directories differ", async () => {
    const root = await writeCorpus([
      { directory: "cases/case-a", manifest: vulnerableCase("same-case") },
      { directory: "cases/case-b", manifest: vulnerableCase("same-case") },
    ]);

    await expect(loadValidationCorpus(root)).rejects.toMatchObject({
      code: "VALIDATION_CORPUS_INVALID",
    });
  });

  it("rejects clean cases that carry positive-only expectations", async () => {
    const root = await writeCorpus([
      {
        directory: "cases/case-clean",
        manifest: cleanCase("case-clean", {
          expectedFiles: ["src/app.ts"],
          expectedSeverity: "medium",
          expectedConfidence: "high",
        }),
      },
    ]);

    await expect(loadValidationCorpus(root)).rejects.toMatchObject({
      code: "VALIDATION_CASE_INVALID",
    });
  });

  it("rejects vulnerable cases without expected files", async () => {
    const root = await writeCorpus([
      {
        directory: "cases/case-a",
        manifest: vulnerableCase("case-a", { expectedFiles: [] }),
      },
    ]);

    await expect(loadValidationCorpus(root)).rejects.toMatchObject({
      code: "VALIDATION_CASE_INVALID",
    });
  });

  it("rejects duplicate expected files and duplicate CWE entries", async () => {
    const duplicateFiles = await writeCorpus([
      {
        directory: "cases/case-a",
        manifest: vulnerableCase("case-a", {
          expectedFiles: ["src/app.ts", "src/app.ts"],
        }),
      },
    ]);
    await expect(loadValidationCorpus(duplicateFiles)).rejects.toMatchObject({
      code: "VALIDATION_CASE_INVALID",
    });

    const duplicateCwe = await writeCorpus([
      {
        directory: "cases/case-b",
        manifest: vulnerableCase("case-b", {
          expectedCwe: ["CWE-95", "CWE-95"],
        }),
      },
    ]);
    await expect(loadValidationCorpus(duplicateCwe)).rejects.toMatchObject({
      code: "VALIDATION_CASE_INVALID",
    });
  });

  it("changes content identity when repository bytes change", async () => {
    const first = await loadValidationCorpus(await writeCorpus([
      {
        directory: "cases/case-a",
        manifest: vulnerableCase("case-a"),
        files: { "src/app.ts": "eval(input);\n" },
      },
    ]));
    const second = await loadValidationCorpus(await writeCorpus([
      {
        directory: "cases/case-a",
        manifest: vulnerableCase("case-a"),
        files: { "src/app.ts": "eval(otherInput);\n" },
      },
    ]));

    expect(first.contentHash).not.toBe(second.contentHash);
  });
});
