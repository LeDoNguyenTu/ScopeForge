import type { BigIntStats } from "node:fs";
import { lstat, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

import { parseDocument } from "yaml";

import { readInventoryEntryBytes } from "../scanner-core/filesystem/read-inventory-entry";
import { buildRepositoryInventory } from "../scanner-core/inventory/build-inventory";
import type { RepositoryInventory } from "../scanner-core/inventory/types";
import {
  SECURITY_PACK_LIMITS,
  type LoadedSecurityPack,
  type SecurityPackRuleV1,
} from "./contracts";
import { SecurityPackError } from "./error";
import { compileSecurityPackPathPattern } from "./path-pattern";
import { readVerifiedManifestBytes } from "./parse";
import type { SecurityPackRegistry } from "./registry";
import { createSecurityPackScanner } from "./scanner";

const CASE_FILE_NAME = "case.json";
const FIXTURE_REPOSITORY_NAME = "repository";
const NESTED_MANIFEST_NAME = "scopeforge-pack.json";
const MAX_CASE_FILE_BYTES = SECURITY_PACK_LIMITS.manifestBytes;
const CASE_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const RULE_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/u;
const CONTROL_OR_BIDI = /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u202a-\u202e\u2066-\u2069]/u;
const FORBIDDEN_FIXTURE_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".pnpm",
  ".yarn",
  "node_modules",
  "vendor",
]);

interface FixtureExpectedLocation {
  readonly file: string;
  readonly startLine: number;
  readonly startColumn: number;
}

interface SecurityPackFixtureCaseV1 {
  readonly schemaVersion: 1;
  readonly caseId: string;
  readonly ruleId: string;
  readonly classification: "positive" | "negative";
  readonly expected: readonly FixtureExpectedLocation[];
  readonly rationale: string;
}

interface DiscoveredFixtureCase {
  readonly metadata: SecurityPackFixtureCaseV1;
  readonly repositoryDirectory: string;
}

interface RuleCoverage {
  positives: number;
  cleanNegatives: number;
  suppressedNearMisses: number;
}

export interface SecurityPackValidationReport {
  readonly schemaVersion: 1;
  readonly packId: string;
  readonly packVersion: string;
  readonly rules: number;
  readonly cases: number;
  readonly findings: number;
  readonly valid: true;
}

function fail(
  code: "PACK_PATH_INVALID" | "PACK_FIXTURE_INVALID" | "PACK_FIXTURE_MISMATCH" | "PACK_BUDGET_EXCEEDED",
  message: string,
): never {
  throw new SecurityPackError(code, message);
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

function boundedText(value: unknown, maximumBytes = SECURITY_PACK_LIMITS.guidanceFieldBytes): string {
  if (typeof value !== "string" || value.length === 0) {
    return fail("PACK_FIXTURE_INVALID", "Fixture metadata contains invalid text.");
  }
  const normalized = value.replace(/\r\n?/gu, "\n");
  if (
    CONTROL_OR_BIDI.test(normalized)
    || hasUnpairedSurrogate(normalized)
    || Buffer.byteLength(normalized, "utf8") > maximumBytes
  ) {
    return fail("PACK_FIXTURE_INVALID", "Fixture metadata contains invalid text.");
  }
  return normalized;
}

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("PACK_FIXTURE_INVALID", "Fixture metadata has an invalid object shape.");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(keys);
  if (
    Object.keys(record).some((key) => !allowed.has(key))
    || keys.some((key) => !Object.prototype.hasOwnProperty.call(record, key))
  ) {
    return fail("PACK_FIXTURE_INVALID", "Fixture metadata has an invalid object shape.");
  }
  return record;
}

function canonicalRepositoryPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.includes("\\") || isAbsolute(value)) {
    return fail("PACK_FIXTURE_INVALID", "Fixture expected path is invalid.");
  }
  const segments = value.split("/");
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..")
    || CONTROL_OR_BIDI.test(value)
    || hasUnpairedSurrogate(value)
    || Buffer.byteLength(value, "utf8") > 4096
  ) {
    return fail("PACK_FIXTURE_INVALID", "Fixture expected path is invalid.");
  }
  return value;
}

function positiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    return fail("PACK_FIXTURE_INVALID", "Fixture expected location is invalid.");
  }
  return Number(value);
}

function parseFixtureCase(value: unknown): SecurityPackFixtureCaseV1 {
  const object = exactObject(value, [
    "schemaVersion",
    "caseId",
    "ruleId",
    "classification",
    "expected",
    "rationale",
  ]);
  if (object.schemaVersion !== 1) {
    return fail("PACK_FIXTURE_INVALID", "Fixture schema version is invalid.");
  }
  if (typeof object.caseId !== "string" || !CASE_ID.test(object.caseId) || object.caseId.length > 120) {
    return fail("PACK_FIXTURE_INVALID", "Fixture case identity is invalid.");
  }
  if (typeof object.ruleId !== "string" || !RULE_ID.test(object.ruleId) || object.ruleId.length > 120) {
    return fail("PACK_FIXTURE_INVALID", "Fixture rule identity is invalid.");
  }
  if (object.classification !== "positive" && object.classification !== "negative") {
    return fail("PACK_FIXTURE_INVALID", "Fixture classification is invalid.");
  }
  if (!Array.isArray(object.expected) || object.expected.length > 1) {
    return fail("PACK_FIXTURE_INVALID", "Fixture expected findings are invalid.");
  }
  const expected = object.expected.map((entry) => {
    const location = exactObject(entry, ["file", "startLine", "startColumn"]);
    return Object.freeze({
      file: canonicalRepositoryPath(location.file),
      startLine: positiveInteger(location.startLine),
      startColumn: positiveInteger(location.startColumn),
    });
  });
  if (
    (object.classification === "positive" && expected.length !== 1)
    || (object.classification === "negative" && expected.length !== 0)
  ) {
    return fail("PACK_FIXTURE_MISMATCH", "Fixture expected finding count does not match its classification.");
  }
  return Object.freeze({
    schemaVersion: 1,
    caseId: object.caseId,
    ruleId: object.ruleId,
    classification: object.classification,
    expected: Object.freeze(expected),
    rationale: boundedText(object.rationale),
  });
}

function isContainedOrEqual(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  if (child === "") return true;
  return !isAbsolute(child)
    && child !== ".."
    && !child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`);
}

function canonicalRelativePath(root: string, candidate: string): string {
  const path = relative(root, candidate).replaceAll("\\", "/");
  if (!path || path.startsWith("../") || path === ".." || isAbsolute(path)) {
    return fail("PACK_PATH_INVALID", "Fixture path escaped its reviewed root.");
  }
  return path;
}

async function safeRealDirectory(path: string, containmentRoot: string): Promise<string> {
  let stat: BigIntStats;
  try {
    stat = await lstat(path, { bigint: true });
  } catch {
    return fail("PACK_PATH_INVALID", "Fixture directory cannot be inspected safely.");
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    return fail("PACK_FIXTURE_INVALID", "Fixture directory must be a real directory.");
  }
  let canonical: string;
  try {
    canonical = await realpath(path);
  } catch {
    return fail("PACK_PATH_INVALID", "Fixture directory identity cannot be verified.");
  }
  if (!isContainedOrEqual(containmentRoot, canonical)) {
    return fail("PACK_PATH_INVALID", "Fixture directory escaped its reviewed root.");
  }
  return canonical;
}

function sameDirectoryIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.isDirectory()
    && right.isDirectory()
    && !left.isSymbolicLink()
    && !right.isSymbolicLink()
    && left.dev === right.dev
    && left.ino === right.ino;
}

async function walkFixtureRepository(root: string): Promise<void> {
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(root);
  } catch {
    return fail("PACK_PATH_INVALID", "Fixture repository identity cannot be verified.");
  }

  const seenCaseFolded = new Set<string>();
  let files = 0;
  let bytes = BigInt(0);

  async function walk(directory: string): Promise<void> {
    let before: BigIntStats;
    try {
      before = await lstat(directory, { bigint: true });
    } catch {
      return fail("PACK_PATH_INVALID", "Fixture directory cannot be inspected safely.");
    }
    if (!before.isDirectory() || before.isSymbolicLink()) {
      return fail("PACK_FIXTURE_INVALID", "Fixture repository contains an invalid directory.");
    }

    let realDirectory: string;
    try {
      realDirectory = await realpath(directory);
    } catch {
      return fail("PACK_PATH_INVALID", "Fixture directory identity cannot be verified.");
    }
    if (!isContainedOrEqual(canonicalRoot, realDirectory)) {
      return fail("PACK_PATH_INVALID", "Fixture repository path escaped its reviewed root.");
    }

    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return fail("PACK_PATH_INVALID", "Fixture directory cannot be enumerated safely.");
    }
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);

    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      let stat: BigIntStats;
      try {
        stat = await lstat(absolute, { bigint: true });
      } catch {
        return fail("PACK_PATH_INVALID", "Fixture entry cannot be inspected safely.");
      }
      if (stat.isSymbolicLink()) {
        return fail("PACK_FIXTURE_INVALID", "Fixture repositories cannot contain symbolic links.");
      }

      const repositoryPath = canonicalRelativePath(canonicalRoot, absolute);
      const folded = repositoryPath.toLowerCase();
      if (seenCaseFolded.has(folded)) {
        return fail("PACK_FIXTURE_INVALID", "Fixture paths collide case-insensitively.");
      }
      seenCaseFolded.add(folded);

      if (stat.isDirectory()) {
        if (entry.name.startsWith(".") || FORBIDDEN_FIXTURE_DIRECTORIES.has(entry.name)) {
          return fail("PACK_FIXTURE_INVALID", "Fixture repository contains a forbidden directory.");
        }
        await walk(absolute);
        continue;
      }

      if (!stat.isFile()) {
        return fail("PACK_FIXTURE_INVALID", "Fixture repository contains an unsupported file type.");
      }
      if (stat.nlink !== BigInt(1)) {
        return fail("PACK_FIXTURE_INVALID", "Fixture files must not be hard-linked.");
      }
      if (entry.name === NESTED_MANIFEST_NAME) {
        return fail("PACK_FIXTURE_INVALID", "Nested Security Pack manifests are not allowed in fixtures.");
      }

      files += 1;
      bytes += stat.size;
      if (files > SECURITY_PACK_LIMITS.fixtureFilesPerCase) {
        return fail("PACK_BUDGET_EXCEEDED", "Fixture case exceeds the fixed file limit.");
      }
      if (bytes > BigInt(SECURITY_PACK_LIMITS.fixtureBytesPerCase)) {
        return fail("PACK_BUDGET_EXCEEDED", "Fixture case exceeds the fixed byte limit.");
      }
    }

    let after: BigIntStats;
    try {
      after = await lstat(directory, { bigint: true });
    } catch {
      return fail("PACK_PATH_INVALID", "Fixture directory changed during validation.");
    }
    if (!sameDirectoryIdentity(before, after)) {
      return fail("PACK_PATH_INVALID", "Fixture directory changed during validation.");
    }
  }

  await walk(canonicalRoot);
}

async function readFixtureCase(caseRoot: string): Promise<SecurityPackFixtureCaseV1> {
  const casePath = join(caseRoot, CASE_FILE_NAME);
  let stat: BigIntStats;
  try {
    stat = await lstat(casePath, { bigint: true });
  } catch {
    return fail("PACK_FIXTURE_INVALID", "Fixture case metadata is missing or unreadable.");
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== BigInt(1)) {
    return fail("PACK_FIXTURE_INVALID", "Fixture case metadata must be a regular single-link file.");
  }
  if (stat.size > BigInt(MAX_CASE_FILE_BYTES)) {
    return fail("PACK_BUDGET_EXCEEDED", "Fixture case metadata exceeds its fixed byte limit.");
  }

  const bytes = await readVerifiedManifestBytes(casePath, caseRoot, stat, MAX_CASE_FILE_BYTES);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail("PACK_FIXTURE_INVALID", "Fixture case metadata is not valid UTF-8.");
  }
  const duplicateCheck = parseDocument(text, { schema: "json", uniqueKeys: true });
  if (duplicateCheck.errors.length > 0) {
    return fail("PACK_FIXTURE_INVALID", "Fixture case metadata is not strict unique-key JSON.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("PACK_FIXTURE_INVALID", "Fixture case metadata is not strict JSON.");
  }
  return parseFixtureCase(raw);
}

async function discoverCases(pack: LoadedSecurityPack): Promise<readonly DiscoveredFixtureCase[]> {
  const fixturesPath = join(pack.packDirectory, "fixtures");
  const fixturesRoot = await safeRealDirectory(fixturesPath, pack.packDirectory);
  let fixtureEntries;
  try {
    fixtureEntries = await readdir(fixturesRoot, { withFileTypes: true });
  } catch {
    return fail("PACK_PATH_INVALID", "Fixture collection cannot be enumerated safely.");
  }
  fixtureEntries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);

  const maximumCases = SECURITY_PACK_LIMITS.rulesPerPack * SECURITY_PACK_LIMITS.fixtureCasesPerRule;
  if (fixtureEntries.length > maximumCases) {
    return fail("PACK_BUDGET_EXCEEDED", "Security Pack fixture count exceeds the fixed limit.");
  }

  const seenCaseFolded = new Set<string>();
  const perRule = new Map<string, number>();
  const ruleIds = new Set(pack.manifest.rules.map((rule) => rule.id));
  const discovered: DiscoveredFixtureCase[] = [];

  for (const entry of fixtureEntries) {
    const folded = entry.name.toLowerCase();
    if (seenCaseFolded.has(folded)) {
      return fail("PACK_FIXTURE_INVALID", "Fixture case directories collide case-insensitively.");
    }
    seenCaseFolded.add(folded);
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) {
      return fail("PACK_FIXTURE_INVALID", "Fixture collection contains an invalid case directory.");
    }

    const caseRoot = await safeRealDirectory(join(fixturesRoot, entry.name), fixturesRoot);
    let caseEntries;
    try {
      caseEntries = await readdir(caseRoot, { withFileTypes: true });
    } catch {
      return fail("PACK_PATH_INVALID", "Fixture case directory cannot be enumerated safely.");
    }
    caseEntries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    if (
      caseEntries.length !== 2
      || caseEntries[0]?.name !== CASE_FILE_NAME
      || caseEntries[1]?.name !== FIXTURE_REPOSITORY_NAME
    ) {
      return fail("PACK_FIXTURE_INVALID", "Fixture case layout is invalid.");
    }

    const metadata = await readFixtureCase(caseRoot);
    if (metadata.caseId !== entry.name) {
      return fail("PACK_FIXTURE_INVALID", "Fixture case identity does not match its directory.");
    }
    if (!ruleIds.has(metadata.ruleId)) {
      return fail("PACK_FIXTURE_MISMATCH", "Fixture case refers to an unknown Security Pack rule.");
    }

    const nextCount = (perRule.get(metadata.ruleId) ?? 0) + 1;
    if (nextCount > SECURITY_PACK_LIMITS.fixtureCasesPerRule) {
      return fail("PACK_BUDGET_EXCEEDED", "Security Pack rule exceeds the fixed fixture case limit.");
    }
    perRule.set(metadata.ruleId, nextCount);

    const repositoryDirectory = await safeRealDirectory(
      join(caseRoot, FIXTURE_REPOSITORY_NAME),
      caseRoot,
    );
    await walkFixtureRepository(repositoryDirectory);
    discovered.push(Object.freeze({ metadata, repositoryDirectory }));
  }

  return Object.freeze(discovered);
}

function compileRulePathMatcher(rule: SecurityPackRuleV1): (repositoryPath: string) => boolean {
  const includes = rule.matcher.include.map((pattern) => compileSecurityPackPathPattern(pattern));
  const excludes = rule.matcher.exclude.map((pattern) => compileSecurityPackPathPattern(pattern));
  return (repositoryPath: string): boolean =>
    includes.some((pattern) => pattern.matches(repositoryPath))
    && !excludes.some((pattern) => pattern.matches(repositoryPath));
}

function registryForOneRule(pack: LoadedSecurityPack, rule: SecurityPackRuleV1): SecurityPackRegistry {
  const registered = Object.freeze({
    pack,
    rule,
    publishedRuleId: `pack/${pack.manifest.packId}/${rule.id}`,
    matchesPath: compileRulePathMatcher(rule),
  });
  return Object.freeze({
    packs: Object.freeze([pack]),
    rules: Object.freeze([registered]),
  });
}

function asciiLowercaseBytes(value: Buffer): Buffer {
  const output = Buffer.from(value);
  for (let index = 0; index < output.length; index += 1) {
    const byte = output[index]!;
    if (byte >= 0x41 && byte <= 0x5a) output[index] = byte + 0x20;
  }
  return output;
}

function containsLiteral(bytes: Buffer, literal: string, caseSensitive: boolean): boolean {
  const needle = Buffer.from(literal, "utf8");
  if (caseSensitive) return bytes.indexOf(needle) >= 0;
  return asciiLowercaseBytes(bytes).indexOf(asciiLowercaseBytes(needle)) >= 0;
}

function pathClassification(rule: SecurityPackRuleV1, repositoryPath: string): {
  included: boolean;
  excluded: boolean;
} {
  const included = rule.matcher.include.some((pattern) =>
    compileSecurityPackPathPattern(pattern).matches(repositoryPath),
  );
  const excluded = rule.matcher.exclude.some((pattern) =>
    compileSecurityPackPathPattern(pattern).matches(repositoryPath),
  );
  return { included, excluded };
}

async function isSuppressedNearMiss(
  rule: SecurityPackRuleV1,
  inventory: RepositoryInventory,
): Promise<boolean> {
  for (const entry of inventory.entries) {
    const bytes = await readInventoryEntryBytes(inventory, entry.path, {
      maxFileBytes: SECURITY_PACK_LIMITS.fixtureBytesPerCase,
    });
    const requiredPresence = rule.matcher.literals.map((literal) =>
      containsLiteral(bytes, literal, rule.matcher.caseSensitive),
    );
    const hasRequired = rule.matcher.mode === "all"
      ? requiredPresence.every(Boolean)
      : requiredPresence.some(Boolean);
    if (!hasRequired) continue;

    const path = pathClassification(rule, entry.path);
    if (path.included && path.excluded) return true;
    if (
      path.included
      && !path.excluded
      && rule.matcher.absentLiterals.some((literal) =>
        containsLiteral(bytes, literal, rule.matcher.caseSensitive),
      )
    ) {
      return true;
    }
  }
  return false;
}

async function containsAnyRequiredLiteral(
  rule: SecurityPackRuleV1,
  inventory: RepositoryInventory,
): Promise<boolean> {
  for (const entry of inventory.entries) {
    const bytes = await readInventoryEntryBytes(inventory, entry.path, {
      maxFileBytes: SECURITY_PACK_LIMITS.fixtureBytesPerCase,
    });
    if (rule.matcher.literals.some((literal) =>
      containsLiteral(bytes, literal, rule.matcher.caseSensitive),
    )) {
      return true;
    }
  }
  return false;
}

function assertExpectedFindings(
  pack: LoadedSecurityPack,
  fixtureCase: SecurityPackFixtureCaseV1,
  findings: readonly {
    ruleId: string;
    location: { file: string; startLine: number; startColumn: number };
  }[],
): void {
  if (findings.length !== fixtureCase.expected.length) {
    return fail("PACK_FIXTURE_MISMATCH", "Fixture scanner result count does not match ground truth.");
  }
  const publishedRuleId = `pack/${pack.manifest.packId}/${fixtureCase.ruleId}`;
  for (let index = 0; index < fixtureCase.expected.length; index += 1) {
    const expected = fixtureCase.expected[index]!;
    const finding = findings[index]!;
    if (
      finding.ruleId !== publishedRuleId
      || finding.location.file !== expected.file
      || finding.location.startLine !== expected.startLine
      || finding.location.startColumn !== expected.startColumn
    ) {
      return fail("PACK_FIXTURE_MISMATCH", "Fixture scanner result location does not match ground truth.");
    }
  }
}

export async function validateSecurityPackFixtures(
  pack: LoadedSecurityPack,
): Promise<SecurityPackValidationReport> {
  const cases = await discoverCases(pack);
  const rules = new Map(pack.manifest.rules.map((rule) => [rule.id, rule] as const));
  const coverage = new Map<string, RuleCoverage>(
    pack.manifest.rules.map((rule) => [rule.id, {
      positives: 0,
      cleanNegatives: 0,
      suppressedNearMisses: 0,
    }]),
  );
  let findingCount = 0;

  for (const fixture of cases) {
    const rule = rules.get(fixture.metadata.ruleId);
    if (!rule) {
      return fail("PACK_FIXTURE_MISMATCH", "Fixture case refers to an unknown Security Pack rule.");
    }

    const inventory = await buildRepositoryInventory(fixture.repositoryDirectory, {
      maxFiles: SECURITY_PACK_LIMITS.fixtureFilesPerCase,
      maxFileBytes: SECURITY_PACK_LIMITS.fixtureBytesPerCase,
      maxTotalBytes: SECURITY_PACK_LIMITS.fixtureBytesPerCase,
    });
    if (inventory.summary.filesSkipped !== 0) {
      return fail("PACK_FIXTURE_INVALID", "Fixture repository cannot rely on ignored or skipped content.");
    }

    const result = await createSecurityPackScanner(registryForOneRule(pack, rule)).scan({
      root: fixture.repositoryDirectory,
      inventory,
    });
    const normalized = Array.isArray(result) ? { findings: result, errors: [] } : result;
    if (normalized.errors.length > 0) {
      return fail("PACK_FIXTURE_INVALID", "Fixture repository could not be scanned safely.");
    }
    assertExpectedFindings(pack, fixture.metadata, normalized.findings);
    findingCount += normalized.findings.length;

    const ruleCoverage = coverage.get(rule.id)!;
    if (fixture.metadata.classification === "positive") {
      ruleCoverage.positives += 1;
      continue;
    }
    if (await isSuppressedNearMiss(rule, inventory)) {
      ruleCoverage.suppressedNearMisses += 1;
    } else if (!(await containsAnyRequiredLiteral(rule, inventory))) {
      ruleCoverage.cleanNegatives += 1;
    }
  }

  for (const item of coverage.values()) {
    if (item.positives < 1 || item.cleanNegatives < 1 || item.suppressedNearMisses < 1) {
      return fail(
        "PACK_FIXTURE_MISMATCH",
        "Every Security Pack rule requires positive, clean-negative, and suppressed near-miss fixtures.",
      );
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    packId: pack.manifest.packId,
    packVersion: pack.manifest.version,
    rules: pack.manifest.rules.length,
    cases: cases.length,
    findings: findingCount,
    valid: true,
  });
}
