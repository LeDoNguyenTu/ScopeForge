import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildRepositoryInventory } from "@/packages/scanner-core/inventory/build-inventory";
import { createJstsScanner } from "@/packages/scanner-jsts/scanner";

const tempPaths: string[] = [];

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), "scopeforge-jsts-"));
  tempPaths.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("createJstsScanner", () => {
  it("continues across malformed files and exposes incomplete parse coverage", async () => {
    const root = await tempDir();
    await writeFile(join(root, "broken.ts"), "export const broken = ;\n");
    await writeFile(join(root, "runtime.ts"), "eval(userCode);\n");
    await writeFile(join(root, "notes.txt"), "eval(userCode);\n");

    const inventory = await buildRepositoryInventory(root);
    const findings = await createJstsScanner().scan({ root, inventory });

    expect(findings.map((finding) => finding.ruleId).sort()).toEqual([
      "jsts/dynamic-code-execution",
      "jsts/parse-error"
    ]);
    expect(findings.find((finding) => finding.ruleId === "jsts/parse-error")?.severity).toBe("info");
  });

  it("honors the shared rule include and exclude selection", async () => {
    const root = await tempDir();
    await writeFile(join(root, "runtime.ts"), "eval(userCode);\nconst agent = { rejectUnauthorized: false };\n");
    const inventory = await buildRepositoryInventory(root);

    const findings = await createJstsScanner({
      rules: { include: ["jsts/tls-verification-disabled"], exclude: [] }
    }).scan({ root, inventory });

    expect(findings.map((finding) => finding.ruleId)).toEqual(["jsts/tls-verification-disabled"]);
  });
});
