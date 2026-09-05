import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluateValidationCorpus,
  loadValidationCorpus,
  renderValidationAccuracyMarkdown,
  runValidationAccuracyCli,
  serializeValidationAccuracyJson,
  type ValidationProvenance,
} from "@/packages/validation-accuracy";

const CORPUS_ROOT = join(process.cwd(), "validation", "corpus", "offline-v1");
const PROVENANCE: ValidationProvenance = Object.freeze({
  scopeforgeVersion: "0.1.0",
  commitSha: "b".repeat(40),
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
});

async function regularFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await regularFiles(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error("Committed validation corpus contains a non-regular entry.");
  }
  return files.sort();
}

async function corpusSnapshot(): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  for (const path of await regularFiles(CORPUS_ROOT)) {
    const key = relative(CORPUS_ROOT, path).replaceAll("\\", "/");
    snapshot[key] = createHash("sha256").update(await readFile(path)).digest("hex");
  }
  return snapshot;
}

function cliOptions() {
  return {
    stdout: (_value: string) => undefined,
    stderr: (_value: string) => undefined,
    toolRoot: process.cwd(),
    cwd: process.cwd(),
  };
}

describe("Phase 8A ground-truth integrity", () => {
  it("cannot mutate committed labels or fixture bytes during evaluation and reporting", async () => {
    const before = await corpusSnapshot();
    expect(Object.keys(before)).toHaveLength(97);

    const corpus = await loadValidationCorpus(CORPUS_ROOT);
    const result = await evaluateValidationCorpus(corpus, PROVENANCE);
    expect(serializeValidationAccuracyJson(result)).toContain("scopeforge-offline-v1");
    expect(renderValidationAccuracyMarkdown(result)).toContain("ScopeForge Offline Validation Report");

    const outputRoot = await mkdtemp(join(tmpdir(), "scopeforge-validation-ground-truth-"));
    const json = join(outputRoot, "result.json");
    const markdown = join(outputRoot, "result.md");
    expect(await runValidationAccuracyCli([
      "--corpus", CORPUS_ROOT,
      "--commit", PROVENANCE.commitSha,
      "--json", json,
      "--markdown", markdown,
    ], cliOptions())).toBe(0);

    expect(await corpusSnapshot()).toEqual(before);
  });

  it("rejects report outputs inside the corpus before writing either output", async () => {
    const outsideRoot = await mkdtemp(join(tmpdir(), "scopeforge-validation-ground-truth-output-"));
    const inside = join(CORPUS_ROOT, "validation-result.json");
    const outside = join(outsideRoot, "validation-result.md");

    expect(await runValidationAccuracyCli([
      "--corpus", CORPUS_ROOT,
      "--commit", PROVENANCE.commitSha,
      "--json", inside,
      "--markdown", outside,
    ], cliOptions())).toBe(2);
    await expect(access(inside)).rejects.toThrow();
    await expect(access(outside)).rejects.toThrow();
  });
});
