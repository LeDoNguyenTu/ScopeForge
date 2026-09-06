import { access, mkdir, mkdtemp, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runValidationAccuracyCli } from "@/packages/validation-accuracy";
import { vulnerableCase, writeCorpus } from "./task1-helpers";

function io() {
  let stdout = "";
  let stderr = "";
  return {
    options: {
      stdout: (value: string) => { stdout += value; },
      stderr: (value: string) => { stderr += value; },
      toolRoot: process.cwd(),
      cwd: process.cwd(),
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

async function oneCaseCorpus(): Promise<string> {
  return writeCorpus([
    {
      directory: "cases/jsts-dynamic-positive-eval",
      manifest: vulnerableCase("jsts-dynamic-positive-eval"),
      files: { "src/app.ts": "eval(input);\n" },
    },
  ]);
}

async function outputRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "scopeforge-validation-output-"));
}

function args(corpus: string, json: string, markdown: string): string[] {
  return [
    "--corpus", corpus,
    "--commit", "a".repeat(40),
    "--json", json,
    "--markdown", markdown,
  ];
}

describe("validation accuracy developer runner", () => {
  it.each([
    ["unknown flag", ["--wat"]],
    ["duplicate flag", ["--corpus", "a", "--corpus", "b"]],
    ["missing value", ["--corpus"]],
    ["invalid commit", ["--corpus", "a", "--commit", "abc", "--json", "x", "--markdown", "y"]],
  ])("rejects %s", async (_label, argv) => {
    const streams = io();
    const code = await runValidationAccuracyCli(argv, streams.options);
    expect(code).toBe(2);
    expect(streams.stderr()).toContain("Validation accuracy error");
  });

  it("rejects output paths inside the corpus before writing", async () => {
    const corpus = await oneCaseCorpus();
    const out = await outputRoot();
    const json = join(corpus, "result.json");
    const markdown = join(out, "result.md");
    const streams = io();

    const code = await runValidationAccuracyCli(args(corpus, json, markdown), streams.options);
    expect(code).toBe(2);
    await expect(access(json)).rejects.toThrow();
    await expect(access(markdown)).rejects.toThrow();
  });

  it("rejects aliased JSON and Markdown outputs", async () => {
    const corpus = await oneCaseCorpus();
    const out = await outputRoot();
    const same = join(out, "result.txt");
    const streams = io();

    expect(await runValidationAccuracyCli(args(corpus, same, same), streams.options)).toBe(2);
    await expect(access(same)).rejects.toThrow();
  });

  it("rejects a symlink output without following it", async () => {
    const corpus = await oneCaseCorpus();
    const out = await outputRoot();
    const target = join(out, "target.json");
    const json = join(out, "result.json");
    const markdown = join(out, "result.md");
    await symlink(target, json);
    const streams = io();

    expect(await runValidationAccuracyCli(args(corpus, json, markdown), streams.options)).toBe(2);
    await expect(access(target)).rejects.toThrow();
    await expect(access(markdown)).rejects.toThrow();
  });

  it("evaluates the corpus and writes deterministic JSON and Markdown outputs", async () => {
    const corpus = await oneCaseCorpus();
    const out = await outputRoot();
    await mkdir(out, { recursive: true });
    const json = join(out, "result.json");
    const markdown = join(out, "result.md");
    const streams = io();

    const code = await runValidationAccuracyCli(args(corpus, json, markdown), streams.options);
    expect(code).toBe(0);
    expect(streams.stderr()).toBe("");
    expect(JSON.parse(await readFile(json, "utf8"))).toMatchObject({
      schemaVersion: 1,
      aggregate: { counts: { tp: 1, error: 0, unsupported: 0 } },
    });
    expect(await readFile(markdown, "utf8")).toContain(
      "# ScopeForge Offline Validation Report - scopeforge-offline-v1",
    );
  });
});
