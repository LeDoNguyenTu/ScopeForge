import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function collectTypeScriptFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const resolved = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await collectTypeScriptFiles(resolved));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(resolved);
  }
  return files;
}

async function source(relativePath: string): Promise<string> {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("hosted finding dependency boundaries", () => {
  it("keeps runtime packages independent of hosted finding persistence", async () => {
    const roots = [
      "packages/runtime-network",
      "packages/runtime-observer",
      "packages/runtime-validator",
    ];

    for (const root of roots) {
      for (const file of await collectTypeScriptFiles(path.resolve(process.cwd(), root))) {
        const contents = await readFile(file, "utf8");
        expect(contents, file).not.toContain("@/lib/security-findings");
      }
    }
  });

  it("keeps hosted finding workflow code outside runtime and network authority", async () => {
    const [repository, service, ingestion] = await Promise.all([
      source("lib/security-findings/repository.ts"),
      source("lib/security-findings/service.ts"),
      source("lib/security-findings/ingestion.ts"),
    ]);

    for (const contents of [repository, service]) {
      expect(contents).not.toMatch(/@\/packages\/runtime-(?:network|observer|validator)/);
      expect(contents).not.toContain("@/lib/runtime-observations");
      expect(contents).not.toContain("@/lib/active-validation");
    }

    expect(ingestion).not.toMatch(/@supabase\/|from ["']next|from ["']react/);
    expect(ingestion).not.toMatch(/@\/packages\/runtime-(?:network|observer|validator)/);
  });

  it("limits ingestion serialization imports to the trusted runtime publication boundaries", async () => {
    const libRoot = path.resolve(process.cwd(), "lib");
    const importers: string[] = [];

    for (const file of await collectTypeScriptFiles(libRoot)) {
      const contents = await readFile(file, "utf8");
      if (contents.includes("@/lib/security-findings/ingestion")) {
        importers.push(path.relative(process.cwd(), file).replaceAll(path.sep, "/"));
      }
    }

    expect(importers.sort()).toEqual([
      "lib/active-validation/repository.ts",
      "lib/runtime-observations/repository.ts",
      "lib/runtime-workers/publication-server-dependencies.ts",
    ]);
  });
});
