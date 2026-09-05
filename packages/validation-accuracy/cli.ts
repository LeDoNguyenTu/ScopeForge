import { constants } from "node:fs";
import { lstat, open, readFile, realpath, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import type { ValidationProvenance } from "./contracts";
import { ValidationAccuracyError } from "./error";
import { evaluateValidationCorpus } from "./evaluate";
import { loadValidationCorpus } from "./parse";
import { serializeValidationAccuracyJson } from "./report-json";
import { renderValidationAccuracyMarkdown } from "./report-markdown";

interface ParsedArguments {
  corpus: string;
  commit: string;
  json: string;
  markdown: string;
}

export interface ValidationAccuracyCliOptions {
  cwd?: string;
  toolRoot?: string;
  stdout?: (value: string) => void;
  stderr?: (value: string) => void;
}

interface OutputTarget {
  canonicalPath: string;
}

function fail(message: string): never {
  throw new ValidationAccuracyError("VALIDATION_OUTPUT_INVALID", message);
}

function parseArguments(argv: readonly string[]): ParsedArguments {
  const accepted = new Set(["--corpus", "--commit", "--json", "--markdown"]);
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]!;
    if (!accepted.has(flag)) fail("Validation accuracy arguments contain an unknown flag.");
    if (values.has(flag)) fail("Validation accuracy arguments contain a duplicate flag.");
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      fail("Validation accuracy argument is missing its value.");
    }
    values.set(flag, value);
    index += 1;
  }

  for (const flag of accepted) {
    if (!values.has(flag)) fail("Validation accuracy arguments are incomplete.");
  }

  const commit = values.get("--commit")!;
  if (!/^[a-f0-9]{40}$/iu.test(commit)) fail("Validation accuracy commit must be a 40-hex SHA.");

  return {
    corpus: values.get("--corpus")!,
    commit: commit.toLowerCase(),
    json: values.get("--json")!,
    markdown: values.get("--markdown")!,
  };
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

async function resolveOutputTarget(cwd: string, value: string): Promise<OutputTarget> {
  const requested = resolve(cwd, value);
  try {
    await lstat(requested);
    return fail("Validation accuracy output must not already exist.");
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }

  const parent = dirname(requested);
  let parentStat;
  try {
    parentStat = await lstat(parent);
  } catch {
    return fail("Validation accuracy output parent must already exist.");
  }
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    return fail("Validation accuracy output parent must be a real directory.");
  }

  let canonicalParent: string;
  try {
    canonicalParent = await realpath(parent);
  } catch {
    return fail("Validation accuracy output parent could not be resolved safely.");
  }
  return { canonicalPath: join(canonicalParent, basename(requested)) };
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return (
    path === ""
    || (!isAbsolute(path) && path !== ".." && !path.startsWith("../") && !path.startsWith("..\\"))
  );
}

async function readToolVersion(toolRoot: string): Promise<string> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(toolRoot, "package.json"), "utf8"));
  } catch {
    return fail("Validation accuracy could not read the trusted ScopeForge package metadata.");
  }
  if (
    typeof raw !== "object"
    || raw === null
    || (raw as { name?: unknown }).name !== "scopeforge"
    || typeof (raw as { version?: unknown }).version !== "string"
  ) {
    return fail("Validation accuracy trusted ScopeForge package metadata is invalid.");
  }
  return (raw as { version: string }).version;
}

async function safeClose(handle: Awaited<ReturnType<typeof open>> | undefined): Promise<void> {
  if (!handle) return;
  try {
    await handle.close();
  } catch {
    // The primary write/open failure remains authoritative.
  }
}

async function safeUnlink(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Best-effort rollback only.
  }
}

async function writeOutputPair(
  jsonTarget: string,
  jsonContent: string,
  markdownTarget: string,
  markdownContent: string,
): Promise<void> {
  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow;
  let jsonHandle: Awaited<ReturnType<typeof open>> | undefined;
  let markdownHandle: Awaited<ReturnType<typeof open>> | undefined;
  let jsonCreated = false;
  let markdownCreated = false;

  try {
    jsonHandle = await open(jsonTarget, flags, 0o600);
    jsonCreated = true;
    markdownHandle = await open(markdownTarget, flags, 0o600);
    markdownCreated = true;
    await jsonHandle.writeFile(jsonContent, "utf8");
    await markdownHandle.writeFile(markdownContent, "utf8");
    await jsonHandle.sync();
    await markdownHandle.sync();
  } catch {
    await safeClose(markdownHandle);
    await safeClose(jsonHandle);
    if (markdownCreated) await safeUnlink(markdownTarget);
    if (jsonCreated) await safeUnlink(jsonTarget);
    return fail("Validation accuracy outputs could not be created safely.");
  }

  await safeClose(markdownHandle);
  await safeClose(jsonHandle);
}

function defaultToolRoot(): string {
  return resolve(__dirname, "..", "..", "..");
}

export async function runValidationAccuracyCli(
  argv: readonly string[],
  options: ValidationAccuracyCliOptions = {},
): Promise<number> {
  const stdout = options.stdout ?? ((value: string) => process.stdout.write(value));
  const stderr = options.stderr ?? ((value: string) => process.stderr.write(value));

  try {
    const parsed = parseArguments(argv);
    const cwd = resolve(options.cwd ?? process.cwd());
    const jsonTarget = await resolveOutputTarget(cwd, parsed.json);
    const markdownTarget = await resolveOutputTarget(cwd, parsed.markdown);
    if (jsonTarget.canonicalPath === markdownTarget.canonicalPath) {
      return fail("Validation accuracy JSON and Markdown outputs must be distinct files.");
    }

    const corpus = await loadValidationCorpus(resolve(cwd, parsed.corpus));
    if (
      isWithin(corpus.corpusDirectory, jsonTarget.canonicalPath)
      || isWithin(corpus.corpusDirectory, markdownTarget.canonicalPath)
    ) {
      return fail("Validation accuracy outputs must remain outside the corpus tree.");
    }

    const provenance: ValidationProvenance = {
      scopeforgeVersion: await readToolVersion(resolve(options.toolRoot ?? defaultToolRoot())),
      commitSha: parsed.commit,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    };
    const result = await evaluateValidationCorpus(corpus, provenance);
    await writeOutputPair(
      jsonTarget.canonicalPath,
      serializeValidationAccuracyJson(result),
      markdownTarget.canonicalPath,
      renderValidationAccuracyMarkdown(result),
    );
    stdout("Validation accuracy reports written.\n");
    return 0;
  } catch (error) {
    if (error instanceof ValidationAccuracyError) {
      stderr(`Validation accuracy error [${error.code}]: ${error.message}\n`);
      return 2;
    }
    stderr("Validation accuracy error [VALIDATION_EVALUATION_ERROR]: Validation accuracy execution failed.\n");
    return 2;
  }
}

if (typeof require !== "undefined" && require.main === module) {
  void runValidationAccuracyCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
