import { afterEach, describe, expect, it } from "vitest";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { createJstsScanner } from "@/packages/scanner-jsts/scanner";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-jsts-noexec-"));
  tempPaths.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("JavaScript scanner execution boundary", () => {
  it("parses hostile top-level code without executing it or its imports", async () => {
    const root = await tempDir();
    const marker = join(root, "executed-marker.txt");
    const source = [
      "import './side-effect-module.js';",
      "const fs = require('node:fs');",
      `fs.writeFileSync(${JSON.stringify(marker)}, 'executed');`,
      "eval(userCode);"
    ].join("\n");
    await writeFile(join(root, "hostile.ts"), source);
    await writeFile(join(root, "side-effect-module.js"), `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'imported');\n`);

    const inventory = await buildRepositoryInventory(root);
    const findings = await createJstsScanner().scan({ root, inventory });

    expect(findings.some((finding) => finding.ruleId === "jsts/dynamic-code-execution")).toBe(true);
    await expect(access(marker)).rejects.toBeTruthy();
  });
});
