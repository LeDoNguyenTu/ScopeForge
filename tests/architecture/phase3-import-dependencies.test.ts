import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const importDir = path.resolve(root, "lib/phase3-import");
const routePath = path.resolve(root, "app/api/phase3-import/route.ts");
const panelPath = path.resolve(root, "components/assets/RepositoryImportPanel.tsx");

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectSourceFiles(target));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(target);
  }
  return files;
}

describe("Phase 5C hosted Phase 3 import architecture", () => {
  it("does not give trusted import modules runtime-network, filesystem-scan, process, VM, worker, or socket authority", async () => {
    const files = await collectSourceFiles(importDir);
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, path.relative(root, file)).not.toMatch(
        /packages\/runtime-|lib\/runtime-|scanner-core\/(?:filesystem|inventory|coordinator)|node:(?:child_process|fs|net|dgram|tls|http|https|vm|worker_threads)|\b(?:spawn|execFile|execSync|fetch)\s*\(/,
      );
    }
  });

  it("keeps repository acquisition and package execution outside the hosted import boundary", async () => {
    const files = await collectSourceFiles(importDir);
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const joined = sources.join("\n");

    expect(joined).not.toMatch(/git\s+clone|git\s+checkout|npm\s+(?:install|ci)|pnpm\s+install|yarn\s+install|repository checkout/i);
  });

  it("keeps model providers and advisory inference outside authoritative Phase 3 import", async () => {
    const files = await collectSourceFiles(importDir);
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const joined = sources.join("\n");

    expect(joined).not.toMatch(/from\s+["'](?:ai|openai|@ai-sdk\/|@anthropic-ai\/|@google\/generative-ai)/);
    expect(joined).not.toMatch(/advisory-inference|model-provider/i);
  });

  it("allows the upload route to accept only the selected asset id as request-side authority", async () => {
    const source = await readFile(routePath, "utf8");
    const queryKeys = [...source.matchAll(/searchParams\.get\("([^"]+)"\)/g)].map((match) => match[1]);

    expect(queryKeys).toEqual(["assetId"]);
    expect(source).not.toMatch(/\bfetch\s*\(|https?:\/\//);
    expect(source).not.toMatch(/targetUrl|repositoryUrl|requestHeaders|requestBody|scanBudget|desiredLifecycle|sourceKind/i);
    expect(source).toContain("validateHostedPhase3Envelope");
    expect(source).toContain("createAdminClient");
  });

  it("keeps browser upload networking same-origin and pinned to the Phase 3 import endpoint", async () => {
    const source = await readFile(panelPath, "utf8");

    expect(source).toContain("fetch(`/api/phase3-import?assetId=${encodeURIComponent(assetId)}`");
    expect(source).not.toMatch(/fetch\(repositoryUrl|fetch\(.*canonical|https?:\/\//);
    expect(source).toContain('headers: { "content-type": "application/json" }');
  });
});