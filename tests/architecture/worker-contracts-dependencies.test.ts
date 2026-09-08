import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CONTRACT_ROOT = path.join(process.cwd(), "packages", "worker-contracts");
const FORBIDDEN_IMPORT_FRAGMENTS = [
  "next/",
  "@supabase/",
  "node:fs",
  "node:child_process",
  "node:http",
  "node:https",
  "node:net",
  "node:dns",
  "node:tls",
  "node:worker_threads",
  "runtime-network",
  "scanner-core",
  "scanner-output",
  "scanner-inventory",
  "openai",
  "anthropic",
  "@google/generative-ai",
] as const;

async function sourceFiles(): Promise<Array<{ file: string; source: string }>> {
  const entries = await readdir(CONTRACT_ROOT, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => entry.name)
    .sort();

  return Promise.all(files.map(async (file) => ({
    file,
    source: await readFile(path.join(CONTRACT_ROOT, file), "utf8"),
  })));
}

describe("worker-contracts dependency boundary", () => {
  it("remains pure and authority-free", async () => {
    const files = await sourceFiles();
    expect(files.length).toBeGreaterThan(0);

    for (const { file, source } of files) {
      for (const fragment of FORBIDDEN_IMPORT_FRAGMENTS) {
        expect(source, `${file} must not import ${fragment}`).not.toContain(fragment);
      }
      const runtimeTypeImports = Array.from(source.matchAll(
        /import[\s\S]*?from ["']@\/packages\/(?:runtime-observer|runtime-validator)["'];/g,
      ));
      for (const [runtimeImport] of runtimeTypeImports) {
        expect(runtimeImport, `${file} runtime contracts must be type-only`).toMatch(/^import type\b/);
      }
      expect(source, `${file} must not invoke fetch`).not.toMatch(/\bfetch\s*\(/);
    }
  });
});
