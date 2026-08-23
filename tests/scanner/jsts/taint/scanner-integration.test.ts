import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ScannerRunResult } from "@/packages/scanner-core/coordinator/types";
import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { createJstsScanner } from "@/packages/scanner-jsts/scanner";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-jsts-taint-scanner-"));
  tempPaths.push(path);
  return path;
}

function structured(result: Awaited<ReturnType<ReturnType<typeof createJstsScanner>["scan"]>>): ScannerRunResult {
  if (Array.isArray(result)) throw new Error("jsts scanner should return structured results");
  return result;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Phase 3E scanner taint integration", () => {
  it("rejects invalid taint budgets at scanner construction", () => {
    expect(() => createJstsScanner({ maxTaintSteps: 0 })).toThrow(/taint-analysis step budget/i);
    expect(() => createJstsScanner({ maxTaintSteps: Number.MAX_SAFE_INTEGER + 1 })).toThrow(/taint-analysis step budget/i);
  });

  it("keeps completed structural findings when taint exceeds its per-file budget", async () => {
    const root = await tempDir();
    const filler = Array.from({ length: 300 }, (_, index) => `const filler${index} = ${index};`).join("\n");
    await writeFile(join(root, "complex.ts"), [
      "eval(userCode);",
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "const app = express();",
      filler,
      "app.get('/run', (req, res) => exec(req.query.cmd));"
    ].join("\n"));

    const inventory = await buildRepositoryInventory(root);
    const result = structured(await createJstsScanner({ maxTaintSteps: 200 }).scan({ root, inventory }));

    expect(result.findings.map((finding) => finding.ruleId)).toContain("jsts/dynamic-code-execution");
    expect(result.findings.map((finding) => finding.ruleId)).not.toContain("jsts/command-injection");
    expect(result.errors).toEqual([
      {
        code: "taint_budget_exceeded",
        file: "complex.ts",
        message: "Source file exceeded the JavaScript/TypeScript taint-analysis step budget."
      }
    ]);
  });

  it("resets the taint budget for each file so one hostile file does not block later files", async () => {
    const root = await tempDir();
    const filler = Array.from({ length: 300 }, (_, index) => `const filler${index} = ${index};`).join("\n");
    await writeFile(join(root, "a-complex.ts"), [
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "const app = express();",
      filler,
      "app.get('/run', (req, res) => exec(req.query.cmd));"
    ].join("\n"));
    await writeFile(join(root, "b-simple.ts"), [
      "import express from 'express';",
      "import { execSync } from 'node:child_process';",
      "const app = express();",
      "app.post('/run', (req, res) => execSync(req.body.command));"
    ].join("\n"));

    const inventory = await buildRepositoryInventory(root);
    const result = structured(await createJstsScanner({ maxTaintSteps: 200 }).scan({ root, inventory }));

    expect(result.findings.map((finding) => [finding.location.file, finding.ruleId])).toContainEqual([
      "b-simple.ts",
      "jsts/command-injection"
    ]);
    expect(result.errors.map((error) => [error.file, error.code])).toContainEqual([
      "a-complex.ts",
      "taint_budget_exceeded"
    ]);
  });
});
