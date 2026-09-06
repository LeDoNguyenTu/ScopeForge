import { constants } from "node:fs";
import { lstat, open, realpath, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { PUBLICATION_EVIDENCE_LIMITS } from "./contracts";
import { PublicationEvidenceError } from "./error";
import { normalizePublicationEvidence } from "./normalize";
import { parsePublicationEvidence } from "./parse-publication";
import { serializeTechnicalPublicationJson } from "./report-json";
import { renderTechnicalPublicationMarkdown } from "./report-markdown";

interface ParsedArguments {
  evidence: string;
  json: string;
  markdown: string;
}

export interface ValidationPublicationCliOptions {
  cwd?: string;
  stdout?: (value: string) => void;
  stderr?: (value: string) => void;
}

function fail(message: string): never {
  throw new PublicationEvidenceError("PUBLICATION_OUTPUT_INVALID", message);
}

function parseArguments(argv: readonly string[]): ParsedArguments {
  const accepted = new Set(["--evidence", "--json", "--markdown"]);
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]!;
    if (!accepted.has(flag)) fail("Technical publication arguments contain an unknown flag.");
    if (values.has(flag)) fail("Technical publication arguments contain a duplicate flag.");
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) fail("Technical publication argument is missing its value.");
    values.set(flag, value);
    index += 1;
  }
  for (const flag of accepted) {
    if (!values.has(flag)) fail("Technical publication arguments are incomplete.");
  }
  return {
    evidence: values.get("--evidence")!,
    json: values.get("--json")!,
    markdown: values.get("--markdown")!,
  };
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

async function readEvidence(path: string): Promise<string> {
  let stat;
  try {
    stat = await lstat(path);
  } catch {
    return fail("Technical publication evidence is missing or unreadable.");
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > PUBLICATION_EVIDENCE_LIMITS.evidenceBytes) {
    return fail("Technical publication evidence must be a bounded regular file.");
  }

  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(path, constants.O_RDONLY | noFollow);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size > PUBLICATION_EVIDENCE_LIMITS.evidenceBytes) {
      return fail("Technical publication evidence changed identity or exceeded its byte budget.");
    }
    return await handle.readFile({ encoding: "utf8" });
  } catch (error) {
    if (error instanceof PublicationEvidenceError) throw error;
    return fail("Technical publication evidence could not be read safely.");
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // The primary read result remains authoritative.
      }
    }
  }
}

async function resolveOutputTarget(cwd: string, value: string): Promise<string> {
  const requested = resolve(cwd, value);
  try {
    await lstat(requested);
    return fail("Technical publication output must not already exist.");
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }

  const parent = dirname(requested);
  let parentStat;
  try {
    parentStat = await lstat(parent);
  } catch {
    return fail("Technical publication output parent must already exist.");
  }
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    return fail("Technical publication output parent must be a real directory.");
  }

  let canonicalParent: string;
  try {
    canonicalParent = await realpath(parent);
  } catch {
    return fail("Technical publication output parent could not be resolved safely.");
  }
  return join(canonicalParent, basename(requested));
}

async function safeClose(handle: Awaited<ReturnType<typeof open>> | undefined): Promise<void> {
  if (!handle) return;
  try {
    await handle.close();
  } catch {
    // The primary output result remains authoritative.
  }
}

async function safeUnlink(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Rollback is best effort only.
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
    return fail("Technical publication outputs could not be created safely.");
  }
  await safeClose(markdownHandle);
  await safeClose(jsonHandle);
}

export async function runValidationPublicationCli(
  argv: readonly string[],
  options: ValidationPublicationCliOptions = {},
): Promise<number> {
  const stdout = options.stdout ?? ((value: string) => process.stdout.write(value));
  const stderr = options.stderr ?? ((value: string) => process.stderr.write(value));
  try {
    const parsed = parseArguments(argv);
    const cwd = resolve(options.cwd ?? process.cwd());
    const evidencePath = resolve(cwd, parsed.evidence);
    const jsonTarget = await resolveOutputTarget(cwd, parsed.json);
    const markdownTarget = await resolveOutputTarget(cwd, parsed.markdown);
    if (jsonTarget === markdownTarget) fail("Technical publication JSON and Markdown outputs must be distinct files.");

    const evidence = parsePublicationEvidence(await readEvidence(evidencePath));
    const normalized = normalizePublicationEvidence(evidence);
    await writeOutputPair(
      jsonTarget,
      serializeTechnicalPublicationJson(normalized),
      markdownTarget,
      renderTechnicalPublicationMarkdown(normalized),
    );
    stdout("Technical publication reports written.\n");
    return 0;
  } catch (error) {
    if (error instanceof PublicationEvidenceError) {
      stderr(`Technical publication error [${error.code}]: ${error.message}\n`);
      return 2;
    }
    stderr("Technical publication error [PUBLICATION_OUTPUT_INVALID]: Technical publication execution failed.\n");
    return 2;
  }
}

if (typeof require !== "undefined" && require.main === module) {
  void runValidationPublicationCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
