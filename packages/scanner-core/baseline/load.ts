import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import type { Severity } from "../findings/types";
import { BaselineError, type BaselineEntry, type BaselineFile } from "./types";

export const MAX_BASELINE_BYTES = 4 * 1024 * 1024;
export const MAX_BASELINE_ENTRIES = 50_000;

const FINGERPRINT = /^sfs?1:[a-f0-9]{64}$/;
const SEVERITIES = new Set<Severity>(["critical", "high", "medium", "low", "info"]);

function isContained(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (!isAbsolute(pathFromRoot) && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`))
  );
}

function nodeErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(object: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = [...keys].sort();
  const actual = Object.keys(object).sort();
  return expected.length === actual.length && expected.every((key, index) => actual[index] === key);
}

function boundedString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    !value.includes("\0")
  );
}

function parseEntry(value: unknown): BaselineEntry | null {
  if (!isPlainObject(value)) return null;
  if (!exactKeys(value, ["fingerprint", "scanner", "ruleId", "ruleVersion", "severity", "file"])) return null;
  if (typeof value.fingerprint !== "string" || !FINGERPRINT.test(value.fingerprint)) return null;
  if (!boundedString(value.scanner, 128)) return null;
  if (!boundedString(value.ruleId, 256)) return null;
  if (!boundedString(value.ruleVersion, 64)) return null;
  if (typeof value.severity !== "string" || !SEVERITIES.has(value.severity as Severity)) return null;
  if (!boundedString(value.file, 2048)) return null;

  return {
    fingerprint: value.fingerprint,
    scanner: value.scanner,
    ruleId: value.ruleId,
    ruleVersion: value.ruleVersion,
    severity: value.severity as Severity,
    file: value.file
  };
}

function parseBaseline(value: unknown): BaselineFile {
  if (!isPlainObject(value) || !exactKeys(value, ["version", "tool", "entries"])) {
    throw new BaselineError("invalid_baseline", "Baseline file does not match the supported schema.");
  }
  if (value.version !== 1) {
    throw new BaselineError("invalid_baseline", "Baseline file version is not supported.");
  }
  if (!isPlainObject(value.tool) || !exactKeys(value.tool, ["name", "version"])) {
    throw new BaselineError("invalid_baseline", "Baseline tool metadata is invalid.");
  }
  if (value.tool.name !== "ScopeForge" || !boundedString(value.tool.version, 128)) {
    throw new BaselineError("invalid_baseline", "Baseline tool metadata is invalid.");
  }
  if (!Array.isArray(value.entries) || value.entries.length > MAX_BASELINE_ENTRIES) {
    throw new BaselineError("invalid_baseline", "Baseline entries are invalid or exceed the supported entry limit.");
  }

  const entries: BaselineEntry[] = [];
  const fingerprints = new Set<string>();
  for (const rawEntry of value.entries) {
    const entry = parseEntry(rawEntry);
    if (!entry || fingerprints.has(entry.fingerprint)) {
      throw new BaselineError("invalid_baseline", "Baseline entries contain invalid or duplicate finding identities.");
    }
    fingerprints.add(entry.fingerprint);
    entries.push(entry);
  }

  entries.sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));
  return {
    version: 1,
    tool: { name: "ScopeForge", version: value.tool.version },
    entries
  };
}

async function readBoundedFile(path: string): Promise<string> {
  let inspected;
  try {
    inspected = await lstat(path);
  } catch {
    throw new BaselineError("baseline_not_readable", "Baseline file is not readable.");
  }

  if (inspected.isSymbolicLink() || !inspected.isFile()) {
    throw new BaselineError("unsafe_baseline", "Baseline must be a regular file and must not be a symlink.");
  }
  if (inspected.size > MAX_BASELINE_BYTES) {
    throw new BaselineError("baseline_too_large", "Baseline file exceeds the supported size limit.");
  }

  const noFollow = (constants as typeof constants & { O_NOFOLLOW?: number }).O_NOFOLLOW ?? 0;
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | noFollow);
  } catch (error) {
    if (nodeErrorCode(error) === "ELOOP") {
      throw new BaselineError("unsafe_baseline", "Baseline must not be opened through a symlink.");
    }
    throw new BaselineError("baseline_not_readable", "Baseline file could not be opened safely.");
  }

  try {
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.dev !== inspected.dev ||
      opened.ino !== inspected.ino
    ) {
      throw new BaselineError("unsafe_baseline", "Baseline file identity changed before it could be read safely.");
    }
    if (opened.size > MAX_BASELINE_BYTES) {
      throw new BaselineError("baseline_too_large", "Baseline file exceeds the supported size limit.");
    }

    const chunks: Buffer[] = [];
    let total = 0;
    let position = 0;
    const chunk = Buffer.allocUnsafe(64 * 1024);
    while (true) {
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, position);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > MAX_BASELINE_BYTES) {
        throw new BaselineError("baseline_too_large", "Baseline file exceeds the supported size limit.");
      }
      chunks.push(Buffer.from(chunk.subarray(0, bytesRead)));
      position += bytesRead;
    }

    const finalStat = await handle.stat();
    if (finalStat.size !== opened.size || finalStat.size !== total) {
      throw new BaselineError("unsafe_baseline", "Baseline file changed while it was being read.");
    }
    return Buffer.concat(chunks, total).toString("utf8");
  } finally {
    await handle.close();
  }
}

export async function loadBaseline(root: string, baselinePath: string): Promise<BaselineFile> {
  const scanRoot = resolve(root);
  const candidate = isAbsolute(baselinePath) ? resolve(baselinePath) : resolve(scanRoot, baselinePath);
  if (!isContained(scanRoot, candidate)) {
    throw new BaselineError("unsafe_baseline", "Baseline path must remain inside the scan root.");
  }

  try {
    const [realRoot, realParent] = await Promise.all([realpath(scanRoot), realpath(dirname(candidate))]);
    if (!isContained(realRoot, realParent)) {
      throw new BaselineError("unsafe_baseline", "Baseline parent directory resolves outside the scan root.");
    }
  } catch (error) {
    if (error instanceof BaselineError) throw error;
    throw new BaselineError("baseline_not_readable", "Baseline parent directory is not safely resolvable.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readBoundedFile(candidate));
  } catch (error) {
    if (error instanceof BaselineError) throw error;
    throw new BaselineError("invalid_baseline", "Baseline file is not valid JSON.");
  }

  return parseBaseline(parsed);
}
