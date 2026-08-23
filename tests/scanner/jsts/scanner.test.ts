import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import type { ScannerRunResult } from "@/packages/scanner-core/coordinator/types";
import { createJstsScanner } from "@/packages/scanner-jsts/scanner";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-jsts-"));
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

describe("createJstsScanner", () => {
  it("scans only bounded JS TS inventory entries and ignores excluded content", async () => {
    const root = await tempDir();
    await mkdir(join(root, "ignored"), { recursive: true });
    await writeFile(join(root, "app.js"), "eval(jsCode);\n");
    await writeFile(join(root, "app.tsx"), "export const View = () => <div />;\n");
    await writeFile(join(root, "notes.txt"), "eval(textOnly);\n");
    await writeFile(join(root, "ignored", "hidden.ts"), "eval(hidden);\n");
    await writeFile(join(root, ".scopeforgeignore"), "ignored/**\n");

    const inventory = await buildRepositoryInventory(root);
    const result = structured(await createJstsScanner().scan({ root, inventory }));

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => finding.location.file)).toEqual(["app.js"]);
  });

  it("continues across malformed files and reports incomplete coverage explicitly", async () => {
    const root = await tempDir();
    await writeFile(join(root, "broken.ts"), "export const broken = ;\n");
    await writeFile(join(root, "runtime.ts"), "eval(userCode);\n");

    const inventory = await buildRepositoryInventory(root);
    const result = structured(await createJstsScanner().scan({ root, inventory }));

    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["jsts/dynamic-code-execution"]);
    expect(result.errors).toEqual([
      {
        code: "syntax_error",
        file: "broken.ts",
        message: "Source file contains syntax errors."
      }
    ]);
  });

  it("fails closed per file when the AST node budget is exceeded", async () => {
    const root = await tempDir();
    const complex = `${Array.from({ length: 20 }, (_, index) => `const value${index} = ${index};`).join("\n")}\neval(complexCode);\n`;
    await writeFile(join(root, "complex.ts"), complex);
    await writeFile(join(root, "simple.ts"), "eval(simpleCode);\n");

    const inventory = await buildRepositoryInventory(root);
    const result = structured(await createJstsScanner({ maxAstNodes: 12 }).scan({ root, inventory }));

    expect(result.findings.map((finding) => finding.location.file)).toEqual(["simple.ts"]);
    expect(result.errors).toEqual([
      {
        code: "ast_budget_exceeded",
        file: "complex.ts",
        message: "Source file exceeded the JavaScript/TypeScript AST node budget."
      }
    ]);
  });

  it("honors shared rule selection", async () => {
    const root = await tempDir();
    await writeFile(join(root, "runtime.ts"), "eval(userCode);\nconst agent = new https.Agent({ rejectUnauthorized: false });\n");
    const inventory = await buildRepositoryInventory(root);

    const result = structured(await createJstsScanner({
      rules: { include: ["jsts/tls-verification-disabled"], exclude: [] }
    }).scan({ root, inventory }));

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["jsts/tls-verification-disabled"]);
  });
});
