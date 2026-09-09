import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

async function sourceFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.(?:ts|tsx)$/u.test(entry.name)) files.push(path);
  }
  return files.sort();
}

describe("Security Pack authority boundary", () => {
  it("requires explicit CLI pack selection and never discovers packs from the scan target", async () => {
    const cli = await readFile(resolve(root, "packages/cli/run-cli.ts"), "utf8");
    expect(cli).toContain('token === "--pack"');
    expect(cli).not.toContain("scopeforge-pack.json");
  });

  it("requires the hosted serializer to reject Security Pack findings directly", async () => {
    const hosted = await readFile(resolve(root, "packages/scanner-output/hosted/serialize.ts"), "utf8");
    expect(hosted).toContain('finding.scanner === "security-pack"');
    expect(hosted).toContain("Hosted ScopeForge export does not accept Security Pack findings.");
  });

  it("keeps browser, hosted-runner, network, and worker authority independent from Security Packs", async () => {
    const authorityDirectories = [
      "app",
      "lib",
      "packages/hosted-scanner-runner",
      "packages/repository-acquisition-network",
      "packages/repository-snapshot-network",
      "packages/runtime-network",
      "packages/runtime-worker-mediator",
      "packages/runtime-worker-runner",
      "packages/runtime-worker-sandbox",
    ];

    for (const directory of authorityDirectories) {
      for (const file of await sourceFiles(resolve(root, directory))) {
        const source = await readFile(file, "utf8");
        expect(source, relative(root, file)).not.toMatch(/packages\/security-packs|security-pack/u);
      }
    }
  });
});
