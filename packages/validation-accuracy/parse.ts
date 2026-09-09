import { createHash } from "node:crypto";
import type { BigIntStats } from "node:fs";
import { lstat, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { parseDocument } from "yaml";

import { compareText } from "../scanner-core/determinism/compare-text";
import type { Confidence, Severity } from "../scanner-core/findings/types";
import {
  VALIDATION_ACCURACY_LIMITS,
  type LoadedValidationCase,
  type LoadedValidationCorpus,
  type ValidationAccuracyErrorCode,
  type ValidationCaseV1,
  type ValidationCorpusV1,
  type ValidationScannerFamily,
} from "./contracts";
import { ValidationAccuracyError } from "./error";
import {
  readVerifiedValidationManifest,
  readVerifiedValidationRepositoryFile,
} from "./safe-read";

const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const STRICT_SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const IDENTITY = /^[a-z0-9]+(?:[./-][a-z0-9]+)*$/u;
const RULE_ID = /^[a-z0-9]+(?:[._/-][a-z0-9]+)*$/u;
const CWE = /^CWE-[0-9]{1,5}$/u;
const WINDOWS_DRIVE = /^[A-Za-z]:/u;

const SEVERITIES = new Set<Severity>(["critical", "high", "medium", "low", "info"]);
const CONFIDENCES = new Set<Confidence>(["high", "medium", "low"]);
const SCANNERS = new Set<ValidationScannerFamily>(["secrets", "jsts", "iac"]);

type JsonObject = Record<string, unknown>;

interface ParsedManifest<T> {
  bytes: Buffer;
  value: T;
}

interface RepositoryFileIdentity {
  path: string;
  size: number;
  digest: string;
}

interface LoadedCaseInternal {
  loaded: LoadedValidationCase;
  manifestBytes: Buffer;
  repositoryFiles: readonly RepositoryFileIdentity[];
}

function fail(code: ValidationAccuracyErrorCode, message: string, field?: string): never {
  throw new ValidationAccuracyError(code, message, field);
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function boundedText(
  value: unknown,
  field: string,
  maximumBytes: number,
  code: ValidationAccuracyErrorCode,
  singleLine = false,
): string {
  if (typeof value !== "string" || value.length === 0) {
    return fail(code, "Validation manifest text is invalid.", field);
  }
  if (
    CONTROL_OR_BIDI.test(value)
    || hasUnpairedSurrogate(value)
    || (singleLine && /[\r\n\u2028\u2029]/u.test(value))
  ) {
    return fail(code, "Validation manifest text is invalid.", field);
  }
  if (Buffer.byteLength(value, "utf8") > maximumBytes) {
    return fail("VALIDATION_BUDGET_EXCEEDED", "Validation manifest text exceeds its fixed byte limit.", field);
  }
  return value;
}

function exactObject(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  field: string,
  code: ValidationAccuracyErrorCode,
): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(code, "Validation manifest object shape is invalid.", field);
  }
  const object = value as JsonObject;
  const allowed = new Set([...required, ...optional]);
  if (
    Object.keys(object).some((key) => !allowed.has(key))
    || required.some((key) => !Object.prototype.hasOwnProperty.call(object, key))
  ) {
    return fail(code, "Validation manifest object shape is invalid.", field);
  }
  return object;
}

function strictSemver(value: unknown, field: string): string {
  const text = boundedText(value, field, 128, "VALIDATION_CORPUS_INVALID", true);
  if (!STRICT_SEMVER.test(text)) {
    return fail("VALIDATION_CORPUS_INVALID", "Validation corpus version is invalid.", field);
  }
  return text;
}

function identity(
  value: unknown,
  field: string,
  code: ValidationAccuracyErrorCode,
  pattern = IDENTITY,
): string {
  const text = boundedText(value, field, 160, code, true);
  if (!pattern.test(text)) return fail(code, "Validation identity is invalid.", field);
  return text;
}

function relativePath(
  value: unknown,
  field: string,
  code: ValidationAccuracyErrorCode,
): string {
  const text = boundedText(value, field, 1024, code, true);
  const segments = text.split("/");
  if (
    isAbsolute(text)
    || WINDOWS_DRIVE.test(text)
    || text.includes("\\")
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    return fail("VALIDATION_PATH_INVALID", "Validation path is not a safe repository-relative path.", field);
  }
  return text;
}

function uniqueStringList(
  value: unknown,
  field: string,
  options: {
    maximum: number;
    code: ValidationAccuracyErrorCode;
    path?: boolean;
    pattern?: RegExp;
  },
): readonly string[] {
  if (!Array.isArray(value) || value.length > options.maximum) {
    return fail(options.code, "Validation manifest list is invalid.", field);
  }
  const seen = new Set<string>();
  const result = value.map((entry, index) => {
    const entryField = `${field}[${index}]`;
    const parsed = options.path
      ? relativePath(entry, entryField, options.code)
      : boundedText(entry, entryField, 160, options.code, true);
    if (options.pattern && !options.pattern.test(parsed)) {
      return fail(options.code, "Validation manifest list entry is invalid.", entryField);
    }
    if (seen.has(parsed)) return fail(options.code, "Validation manifest list contains duplicates.", field);
    seen.add(parsed);
    return parsed;
  });
  return result;
}

function scannerFamily(value: unknown): ValidationScannerFamily {
  if (typeof value !== "string" || !SCANNERS.has(value as ValidationScannerFamily)) {
    return fail("VALIDATION_CASE_INVALID", "Validation scanner family is invalid.", "scanner");
  }
  return value as ValidationScannerFamily;
}

function severity(value: unknown): Severity {
  if (typeof value !== "string" || !SEVERITIES.has(value as Severity)) {
    return fail("VALIDATION_CASE_INVALID", "Validation expected severity is invalid.", "expectedSeverity");
  }
  return value as Severity;
}

function confidence(value: unknown): Confidence {
  if (typeof value !== "string" || !CONFIDENCES.has(value as Confidence)) {
    return fail("VALIDATION_CASE_INVALID", "Validation expected confidence is invalid.", "expectedConfidence");
  }
  return value as Confidence;
}

function parseCorpusV1(value: unknown): ValidationCorpusV1 {
  const object = exactObject(
    value,
    ["schemaVersion", "corpusId", "corpusVersion", "cases"],
    [],
    "corpus",
    "VALIDATION_CORPUS_INVALID",
  );
  if (object.schemaVersion !== 1) {
    return fail("VALIDATION_CORPUS_INVALID", "Validation corpus schema version is invalid.", "schemaVersion");
  }
  if (!Array.isArray(object.cases) || object.cases.length < 1) {
    return fail("VALIDATION_CORPUS_INVALID", "Validation corpus must contain at least one case.", "cases");
  }
  if (object.cases.length > VALIDATION_ACCURACY_LIMITS.corpusCases) {
    return fail("VALIDATION_BUDGET_EXCEEDED", "Validation corpus exceeds its fixed case limit.", "cases");
  }

  const seen = new Set<string>();
  const cases = object.cases.map((entry, index) => {
    const casePath = relativePath(entry, `cases[${index}]`, "VALIDATION_CORPUS_INVALID");
    if (!casePath.startsWith("cases/")) {
      return fail("VALIDATION_PATH_INVALID", "Validation case path must remain under cases/.", `cases[${index}]`);
    }
    if (seen.has(casePath)) {
      return fail("VALIDATION_CORPUS_INVALID", "Validation corpus contains a duplicate case path.", "cases");
    }
    seen.add(casePath);
    return casePath;
  });

  return {
    schemaVersion: 1,
    corpusId: identity(object.corpusId, "corpusId", "VALIDATION_CORPUS_INVALID"),
    corpusVersion: strictSemver(object.corpusVersion, "corpusVersion"),
    cases,
  };
}

function parseCaseV1(value: unknown): ValidationCaseV1 {
  const object = exactObject(
    value,
    ["schemaVersion", "caseId", "scanner", "ruleId", "label", "repository", "rationale", "expectedFiles"],
    ["expectedSeverity", "expectedConfidence", "expectedCwe", "remediationOf", "notes"],
    "case",
    "VALIDATION_CASE_INVALID",
  );
  if (object.schemaVersion !== 1) {
    return fail("VALIDATION_CASE_INVALID", "Validation case schema version is invalid.", "schemaVersion");
  }
  if (object.label !== "vulnerable" && object.label !== "clean") {
    return fail("VALIDATION_CASE_INVALID", "Validation case label is invalid.", "label");
  }
  if (object.repository !== "repository") {
    return fail("VALIDATION_CASE_INVALID", "Validation case repository field is invalid.", "repository");
  }

  const expectedFiles = uniqueStringList(object.expectedFiles, "expectedFiles", {
    maximum: VALIDATION_ACCURACY_LIMITS.expectedFilesPerPositiveCase,
    code: "VALIDATION_CASE_INVALID",
    path: true,
  });
  const expectedCwe = object.expectedCwe === undefined
    ? undefined
    : uniqueStringList(object.expectedCwe, "expectedCwe", {
        maximum: VALIDATION_ACCURACY_LIMITS.expectedFilesPerPositiveCase,
        code: "VALIDATION_CASE_INVALID",
        pattern: CWE,
      });

  if (object.label === "vulnerable") {
    if (expectedFiles.length < 1 || object.expectedSeverity === undefined || object.expectedConfidence === undefined) {
      return fail("VALIDATION_CASE_INVALID", "Vulnerable validation case is missing required expectations.");
    }
  } else if (
    expectedFiles.length !== 0
    || object.expectedSeverity !== undefined
    || object.expectedConfidence !== undefined
    || object.expectedCwe !== undefined
  ) {
    return fail("VALIDATION_CASE_INVALID", "Clean validation case contains vulnerable-only expectations.");
  }

  return {
    schemaVersion: 1,
    caseId: identity(object.caseId, "caseId", "VALIDATION_CASE_INVALID"),
    scanner: scannerFamily(object.scanner),
    ruleId: identity(object.ruleId, "ruleId", "VALIDATION_CASE_INVALID", RULE_ID),
    label: object.label,
    repository: "repository",
    rationale: boundedText(
      object.rationale,
      "rationale",
      VALIDATION_ACCURACY_LIMITS.rationaleBytes,
      "VALIDATION_CASE_INVALID",
    ),
    expectedFiles,
    ...(object.expectedSeverity === undefined ? {} : { expectedSeverity: severity(object.expectedSeverity) }),
    ...(object.expectedConfidence === undefined ? {} : { expectedConfidence: confidence(object.expectedConfidence) }),
    ...(expectedCwe === undefined ? {} : { expectedCwe }),
    ...(object.remediationOf === undefined
      ? {}
      : { remediationOf: identity(object.remediationOf, "remediationOf", "VALIDATION_CASE_INVALID") }),
    ...(object.notes === undefined
      ? {}
      : {
          notes: boundedText(
            object.notes,
            "notes",
            VALIDATION_ACCURACY_LIMITS.notesBytes,
            "VALIDATION_CASE_INVALID",
          ),
        }),
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return (
    rel === ""
    || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith("../") && !rel.startsWith("..\\"))
  );
}

async function safeLstat(
  path: string,
  code: ValidationAccuracyErrorCode,
  message: string,
): Promise<BigIntStats> {
  try {
    return await lstat(path, { bigint: true });
  } catch {
    return fail(code, message);
  }
}

async function strictJson<T>(
  path: string,
  stat: BigIntStats,
  invalidCode: ValidationAccuracyErrorCode,
  parser: (value: unknown) => T,
): Promise<ParsedManifest<T>> {
  const bytes = await readVerifiedValidationManifest(path, stat, invalidCode);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail(invalidCode, "Validation manifest is not valid UTF-8.");
  }

  let document;
  try {
    document = parseDocument(text, { schema: "json", uniqueKeys: true });
  } catch {
    return fail(invalidCode, "Validation manifest is not strict unique-key JSON.");
  }
  if (document.errors.length > 0) {
    return fail(invalidCode, "Validation manifest is not strict unique-key JSON.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(invalidCode, "Validation manifest is not strict JSON.");
  }
  return { bytes, value: parser(raw) };
}

async function validateRepositoryTree(repositoryDirectory: string): Promise<readonly RepositoryFileIdentity[]> {
  const files: RepositoryFileIdentity[] = [];
  let totalBytes = BigInt(0);

  async function walk(directory: string, prefix: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return fail("VALIDATION_REPOSITORY_UNSAFE", "Validation repository directory could not be read safely.");
    }
    entries.sort((left, right) => compareText(left.name, right.name));

    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      const repositoryPath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      const stat = await safeLstat(
        absolute,
        "VALIDATION_REPOSITORY_UNSAFE",
        "Validation repository entry could not be inspected safely.",
      );

      if (stat.isSymbolicLink()) {
        return fail("VALIDATION_REPOSITORY_UNSAFE", "Validation repository must not contain symbolic links.");
      }
      if (stat.isDirectory()) {
        await walk(absolute, repositoryPath);
        continue;
      }
      if (!stat.isFile() || stat.nlink !== BigInt(1)) {
        return fail("VALIDATION_REPOSITORY_UNSAFE", "Validation repository must contain only unique regular files and directories.");
      }
      if (stat.size > BigInt(VALIDATION_ACCURACY_LIMITS.repositoryFileBytes)) {
        return fail("VALIDATION_BUDGET_EXCEEDED", "Validation repository file exceeds its fixed byte limit.");
      }
      if (files.length + 1 > VALIDATION_ACCURACY_LIMITS.repositoryFilesPerCase) {
        return fail("VALIDATION_BUDGET_EXCEEDED", "Validation repository exceeds its fixed file-count limit.");
      }
      totalBytes += stat.size;
      if (totalBytes > BigInt(VALIDATION_ACCURACY_LIMITS.repositoryBytesPerCase)) {
        return fail("VALIDATION_BUDGET_EXCEEDED", "Validation repository exceeds its fixed total-byte limit.");
      }

      const bytes = await readVerifiedValidationRepositoryFile(absolute, stat);
      files.push({
        path: repositoryPath,
        size: bytes.length,
        digest: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }

  await walk(repositoryDirectory, "");
  return files.sort((left, right) => compareText(left.path, right.path));
}

function updateLengthPrefixed(hash: ReturnType<typeof createHash>, label: string, bytes: Buffer): void {
  hash.update(label, "utf8");
  hash.update("\0", "utf8");
  hash.update(String(bytes.length), "utf8");
  hash.update("\0", "utf8");
  hash.update(bytes);
  hash.update("\0", "utf8");
}

function corpusContentHash(corpusBytes: Buffer, cases: readonly LoadedCaseInternal[]): string {
  const hash = createHash("sha256");
  hash.update("scopeforge-validation-corpus-v1\0", "utf8");
  updateLengthPrefixed(hash, "corpus-manifest", corpusBytes);

  const orderedCases = [...cases].sort((left, right) =>
    compareText(left.loaded.manifest.caseId, right.loaded.manifest.caseId));
  for (const item of orderedCases) {
    hash.update(`case\0${item.loaded.manifest.caseId}\0`, "utf8");
    updateLengthPrefixed(hash, "case-manifest", item.manifestBytes);
    for (const file of item.repositoryFiles) {
      hash.update(`file\0${file.path}\0${file.size}\0${file.digest}\0`, "utf8");
    }
  }
  return hash.digest("hex");
}

export async function loadValidationCorpus(corpusDirectory: string): Promise<LoadedValidationCorpus> {
  const requestedRoot = resolve(corpusDirectory);
  const requestedStat = await safeLstat(
    requestedRoot,
    "VALIDATION_PATH_INVALID",
    "Validation corpus root could not be inspected safely.",
  );
  if (!requestedStat.isDirectory() || requestedStat.isSymbolicLink()) {
    return fail("VALIDATION_PATH_INVALID", "Validation corpus root must be a real directory.");
  }

  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(requestedRoot);
  } catch {
    return fail("VALIDATION_PATH_INVALID", "Validation corpus root could not be resolved safely.");
  }

  const corpusManifestPath = join(canonicalRoot, "corpus.json");
  const corpusManifestStat = await safeLstat(
    corpusManifestPath,
    "VALIDATION_CORPUS_INVALID",
    "Validation corpus manifest could not be inspected safely.",
  );
  if (!corpusManifestStat.isFile() || corpusManifestStat.isSymbolicLink() || corpusManifestStat.nlink !== BigInt(1)) {
    return fail("VALIDATION_CORPUS_INVALID", "Validation corpus manifest must be a unique regular file.");
  }
  const parsedCorpus = await strictJson(
    corpusManifestPath,
    corpusManifestStat,
    "VALIDATION_CORPUS_INVALID",
    parseCorpusV1,
  );

  const loadedCases: LoadedCaseInternal[] = [];
  const seenCaseIds = new Set<string>();
  for (const caseReference of parsedCorpus.value.cases) {
    const casePath = resolve(canonicalRoot, caseReference);
    const caseStat = await safeLstat(
      casePath,
      "VALIDATION_PATH_INVALID",
      "Validation case directory could not be inspected safely.",
    );
    if (!caseStat.isDirectory() || caseStat.isSymbolicLink()) {
      return fail("VALIDATION_PATH_INVALID", "Validation case must be a real directory.");
    }

    let canonicalCase: string;
    try {
      canonicalCase = await realpath(casePath);
    } catch {
      return fail("VALIDATION_PATH_INVALID", "Validation case directory could not be resolved safely.");
    }
    if (!isWithin(canonicalRoot, canonicalCase)) {
      return fail("VALIDATION_PATH_INVALID", "Validation case directory escapes the corpus root.");
    }

    const caseManifestPath = join(canonicalCase, "case.json");
    const caseManifestStat = await safeLstat(
      caseManifestPath,
      "VALIDATION_CASE_INVALID",
      "Validation case manifest could not be inspected safely.",
    );
    if (!caseManifestStat.isFile() || caseManifestStat.isSymbolicLink() || caseManifestStat.nlink !== BigInt(1)) {
      return fail("VALIDATION_CASE_INVALID", "Validation case manifest must be a unique regular file.");
    }
    const parsedCase = await strictJson(
      caseManifestPath,
      caseManifestStat,
      "VALIDATION_CASE_INVALID",
      parseCaseV1,
    );
    if (seenCaseIds.has(parsedCase.value.caseId)) {
      return fail("VALIDATION_CORPUS_INVALID", "Validation corpus contains a duplicate case identity.");
    }
    seenCaseIds.add(parsedCase.value.caseId);

    const repositoryDirectory = join(canonicalCase, "repository");
    const repositoryStat = await safeLstat(
      repositoryDirectory,
      "VALIDATION_REPOSITORY_UNSAFE",
      "Validation repository could not be inspected safely.",
    );
    if (!repositoryStat.isDirectory() || repositoryStat.isSymbolicLink()) {
      return fail("VALIDATION_REPOSITORY_UNSAFE", "Validation repository must be a real directory.");
    }
    let canonicalRepository: string;
    try {
      canonicalRepository = await realpath(repositoryDirectory);
    } catch {
      return fail("VALIDATION_REPOSITORY_UNSAFE", "Validation repository could not be resolved safely.");
    }
    if (!isWithin(canonicalCase, canonicalRepository)) {
      return fail("VALIDATION_REPOSITORY_UNSAFE", "Validation repository escapes its case directory.");
    }

    const repositoryFiles = await validateRepositoryTree(canonicalRepository);
    loadedCases.push({
      loaded: {
        caseDirectory: canonicalCase,
        repositoryDirectory: canonicalRepository,
        manifestPath: caseManifestPath,
        manifest: deepFreeze(parsedCase.value),
      },
      manifestBytes: parsedCase.bytes,
      repositoryFiles,
    });
  }

  const result: LoadedValidationCorpus = {
    corpusDirectory: canonicalRoot,
    manifestPath: corpusManifestPath,
    manifest: deepFreeze(parsedCorpus.value),
    cases: loadedCases.map((item) => deepFreeze(item.loaded)),
    contentHash: corpusContentHash(parsedCorpus.bytes, loadedCases),
  };
  return deepFreeze(result);
}
