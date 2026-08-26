import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

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

describe("Phase 6B repository acquisition architecture", () => {
  it("keeps acquisition executors free of process, scanner, model and Supabase authority", async () => {
    const files = [
      ...await collectSourceFiles(path.resolve(root, "packages/repository-acquisition-network")),
      ...await collectSourceFiles(path.resolve(root, "packages/repository-snapshot")),
      path.resolve(root, "packages/worker-supervisor/repository-snapshot.ts"),
    ];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, path.relative(root, file)).not.toMatch(
        /node:(?:child_process|worker_threads)|\b(?:spawn|exec|execFile|fork)\s*\(|@supabase\/|lib\/supabase|scanner-core\/(?:filesystem|inventory|coordinator)|scanner-coordinator|runtime-observations|active-validation|model-provider|@anthropic-ai\/|@ai-sdk\/|from\s+["']openai["']/,
      );
      expect(source, path.relative(root, file)).not.toMatch(
        /\b(?:npm|pnpm|yarn|bun)\s+(?:install|ci|run|exec)|package-manager/i,
      );
    }
  });

  it("keeps the foundation zero-egress path free of GitHub and R2 authority", async () => {
    const files = [
      path.resolve(root, "packages/worker-supervisor/foundation-probe.ts"),
      path.resolve(root, "tests/workers/foundation-probe.test.ts"),
    ];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, path.relative(root, file)).not.toMatch(
        /repository-acquisition-network|repository-snapshot|api[.]github[.]com|codeload[.]github[.]com|cloudflarestorage[.]com|R2_/,
      );
    }
  });

  it("keeps private object-store and worker-broker authority out of browser components", async () => {
    const files = await collectSourceFiles(path.resolve(root, "components"));
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, path.relative(root, file)).not.toMatch(
        /R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|r2-signature-v4|r2-object-store|repository-snapshots\/object-store|repository-snapshots\/server-|api\/internal\/workers|lib\/worker-control|worker-supervisor|repository-source\/[a-f0-9]/,
      );
    }
  });

  it("uses the reviewed public database surface without temporary generic RPC casts", async () => {
    const files = [
      path.resolve(root, "lib/repository-snapshots/read-model.ts"),
      path.resolve(root, "lib/repository-snapshots/repository.ts"),
      path.resolve(root, "lib/repository-snapshots/cleanup-repository.ts"),
    ];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, path.relative(root, file)).not.toContain("as unknown as");
      expect(source, path.relative(root, file)).not.toMatch(
        /interface\s+(?:SnapshotReadClient|RepositorySnapshotRpc|CleanupRpc)\b/,
      );
    }
  });

  it("keeps Phase 6B acquisition separate from scanner and finding persistence", async () => {
    const files = await collectSourceFiles(path.resolve(root, "packages/repository-snapshot"));
    const networkFiles = await collectSourceFiles(path.resolve(root, "packages/repository-acquisition-network"));
    const source = (await Promise.all([...files, ...networkFiles].map((file) => readFile(file, "utf8")))).join("\n");
    expect(source).not.toMatch(/security_findings|persist_phase3_import_result|scanner-core\/coordinator|mapPhase3Finding|finding_rows|evidence_rows/);
  });
});
