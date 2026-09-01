import { constants, type Stats } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { parseDocument } from "yaml";

import {
  SECURITY_PACK_LIMITS,
  type LoadedSecurityPack,
  type SecurityPackLicense,
  type SecurityPackManifestV1,
  type SecurityPackRuleV1,
  type StaticLiteralMatcherV1,
} from "./contracts";
import { SecurityPackError, type SecurityPackErrorCode } from "./error";

const MANIFEST_NAME = "scopeforge-pack.json";
const CONTROL_OR_BIDI = /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u202a-\u202e\u2066-\u2069]/u;
const STRICT_SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const PACK_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const RULE_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/u;
const GITHUB_HANDLE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u;
const CWE_MAPPING = /^CWE-[0-9]{1,5}$/u;
const OWASP_MAPPING = /^A[0-9]{2}:[0-9]{4}$/u;
const ATTACK_MAPPING = /^T[0-9]{4}(?:\.[0-9]{3})?$/u;
const NIST_CSF_MAPPING = /^[A-Z][A-Z0-9]*(?:[.-][A-Z0-9]+)+$/u;

type JsonObject = Record<string, unknown>;

function fail(
  code: SecurityPackErrorCode,
  message: string,
  field?: string,
): never {
  throw new SecurityPackError(code, message, field);
}

function exactObject(
  value: unknown,
  expectedKeys: readonly string[],
  field: string,
): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("PACK_MANIFEST_INVALID", "Pack manifest field has an invalid object shape.", field);
  }
  const record = value as JsonObject;
  const allowed = new Set(expectedKeys);
  if (
    Object.keys(record).some((key) => !allowed.has(key))
    || expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(record, key))
  ) {
    return fail("PACK_MANIFEST_INVALID", "Pack manifest field has an invalid object shape.", field);
  }
  return record;
}

function boundedText(
  value: unknown,
  field: string,
  maximumBytes = SECURITY_PACK_LIMITS.guidanceFieldBytes,
  normalizeLineEndings = true,
): string {
  if (typeof value !== "string" || value.length === 0) {
    return fail("PACK_MANIFEST_INVALID", "Pack manifest text is invalid.", field);
  }
  const normalized = normalizeLineEndings ? value.replace(/\r\n?/gu, "\n") : value;
  if (CONTROL_OR_BIDI.test(normalized) || hasUnpairedSurrogate(normalized)) {
    return fail("PACK_MANIFEST_INVALID", "Pack manifest text is invalid.", field);
  }
  if (Buffer.byteLength(normalized, "utf8") > maximumBytes) {
    return fail("PACK_BUDGET_EXCEEDED", "Pack manifest field exceeds its fixed byte limit.", field);
  }
  return normalized;
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

function singleLineText(
  value: unknown,
  field: string,
  maximumBytes = SECURITY_PACK_LIMITS.guidanceFieldBytes,
): string {
  if (typeof value !== "string" || /[\r\n]/u.test(value)) {
    return fail("PACK_MANIFEST_INVALID", "Pack manifest single-line text is invalid.", field);
  }
  return boundedText(value, field, maximumBytes, false);
}

function strictSemver(value: unknown, field: string): string {
  const version = singleLineText(value, field, 128);
  if (!STRICT_SEMVER.test(version)) {
    return fail("PACK_IDENTITY_INVALID", "Pack semantic version is invalid.", field);
  }
  return version;
}

function packId(value: unknown, field: string): string {
  const id = singleLineText(value, field, 100);
  if (Buffer.byteLength(id, "utf8") < 3 || !PACK_ID.test(id)) {
    return fail("PACK_IDENTITY_INVALID", "Pack identity is invalid.", field);
  }
  return id;
}

function ruleId(value: unknown, field: string): string {
  const id = singleLineText(value, field, 120);
  if (Buffer.byteLength(id, "utf8") < 3 || !RULE_ID.test(id)) {
    return fail("PACK_IDENTITY_INVALID", "Pack rule identity is invalid.", field);
  }
  return id;
}

function githubHandle(value: unknown, field: string): string {
  const handle = singleLineText(value, field, 39);
  if (!GITHUB_HANDLE.test(handle) || handle.includes("--")) {
    return fail("PACK_IDENTITY_INVALID", "Pack maintainer identity is invalid.", field);
  }
  return handle;
}

function githubRepositoryUrl(value: unknown, field: string): string {
  const repository = singleLineText(value, field, 2048);
  let parsed: URL;
  try {
    parsed = new URL(repository);
  } catch {
    return fail("PACK_IDENTITY_INVALID", "Pack repository URL is invalid.", field);
  }
  const segments = parsed.pathname.split("/").slice(1);
  if (
    parsed.protocol !== "https:"
    || parsed.hostname !== "github.com"
    || parsed.port !== ""
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.search !== ""
    || parsed.hash !== ""
    || segments.length !== 2
    || !GITHUB_HANDLE.test(segments[0] ?? "")
    || (segments[0] ?? "").includes("--")
    || !/^[A-Za-z0-9._-]{1,100}$/u.test(segments[1] ?? "")
    || segments[1] === "."
    || segments[1] === ".."
    || segments[1]?.endsWith(".git")
    || parsed.href !== repository
  ) {
    return fail("PACK_IDENTITY_INVALID", "Pack repository URL is invalid.", field);
  }
  return repository;
}

function textList(
  value: unknown,
  field: string,
  options: {
    minimum?: number;
    maximum?: number;
    entryMaximumBytes?: number;
    singleLine?: boolean;
    normalizeLineEndings?: boolean;
  } = {},
): readonly string[] {
  if (!Array.isArray(value)) {
    return fail("PACK_MANIFEST_INVALID", "Pack manifest list is invalid.", field);
  }
  const minimum = options.minimum ?? 0;
  if (value.length < minimum) {
    return fail("PACK_MANIFEST_INVALID", "Pack manifest list is invalid.", field);
  }
  if (options.maximum !== undefined && value.length > options.maximum) {
    return fail("PACK_BUDGET_EXCEEDED", "Pack manifest list exceeds its fixed item limit.", field);
  }
  return value.map((entry, index) => {
    const entryField = `${field}[${index}]`;
    return options.singleLine
      ? singleLineText(entry, entryField, options.entryMaximumBytes)
      : boundedText(
          entry,
          entryField,
          options.entryMaximumBytes,
          options.normalizeLineEndings,
        );
  });
}

function mappingList(
  value: unknown,
  field: string,
  pattern: RegExp,
): readonly string[] {
  if (!Array.isArray(value)) {
    return fail("PACK_MANIFEST_INVALID", "Pack mapping list is invalid.", field);
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const entryField = `${field}[${index}]`;
    const mapping = singleLineText(entry, entryField, 64);
    if (!pattern.test(mapping) || seen.has(mapping)) {
      return fail("PACK_MANIFEST_INVALID", "Pack mapping is invalid.", entryField);
    }
    seen.add(mapping);
    return mapping;
  });
}

function matcherV1(value: unknown, field: string): StaticLiteralMatcherV1 {
  const object = exactObject(
    value,
    ["include", "exclude", "mode", "literals", "absentLiterals", "caseSensitive"],
    field,
  );
  const include = textList(object.include, `${field}.include`, {
    minimum: 1,
    maximum: SECURITY_PACK_LIMITS.includePatternsPerRule,
    entryMaximumBytes: SECURITY_PACK_LIMITS.manifestBytes,
    singleLine: true,
  });
  const exclude = textList(object.exclude, `${field}.exclude`, {
    maximum: SECURITY_PACK_LIMITS.excludePatternsPerRule,
    entryMaximumBytes: SECURITY_PACK_LIMITS.manifestBytes,
    singleLine: true,
  });
  const literals = textList(object.literals, `${field}.literals`, {
    minimum: 1,
    maximum: SECURITY_PACK_LIMITS.literalsPerRule,
    entryMaximumBytes: SECURITY_PACK_LIMITS.literalBytes,
    singleLine: false,
    normalizeLineEndings: false,
  });
  const absentLiterals = textList(object.absentLiterals, `${field}.absentLiterals`, {
    maximum: SECURITY_PACK_LIMITS.literalsPerRule,
    entryMaximumBytes: SECURITY_PACK_LIMITS.literalBytes,
    singleLine: false,
    normalizeLineEndings: false,
  });
  if (object.mode !== "any" && object.mode !== "all") {
    return fail("PACK_MANIFEST_INVALID", "Pack matcher mode is invalid.", `${field}.mode`);
  }
  if (typeof object.caseSensitive !== "boolean") {
    return fail("PACK_MANIFEST_INVALID", "Pack matcher case setting is invalid.", `${field}.caseSensitive`);
  }
  if (
    !object.caseSensitive
    && [...literals, ...absentLiterals].some((literal) => !/^[\x00-\x7f]*$/u.test(literal))
  ) {
    return fail("PACK_MANIFEST_INVALID", "Pack case-insensitive literals must be ASCII.", `${field}.caseSensitive`);
  }
  return { include, exclude, mode: object.mode, literals, absentLiterals, caseSensitive: object.caseSensitive };
}

function ruleV1(value: unknown, index: number): SecurityPackRuleV1 {
  const field = `rules[${index}]`;
  const object = exactObject(value, [
    "id",
    "version",
    "kind",
    "title",
    "summary",
    "description",
    "severity",
    "confidence",
    "category",
    "mappings",
    "explanations",
    "remediation",
    "preparedness",
    "falsePositiveNotes",
    "matcher",
  ], field);
  if (object.kind !== "static_literal_v1") {
    return fail("PACK_MANIFEST_INVALID", "Pack rule kind is invalid.", `${field}.kind`);
  }
  const severities = new Set(["critical", "high", "medium", "low", "info"]);
  if (typeof object.severity !== "string" || !severities.has(object.severity)) {
    return fail("PACK_MANIFEST_INVALID", "Pack rule severity is invalid.", `${field}.severity`);
  }
  const confidences = new Set(["high", "medium", "low"]);
  if (typeof object.confidence !== "string" || !confidences.has(object.confidence)) {
    return fail("PACK_MANIFEST_INVALID", "Pack rule confidence is invalid.", `${field}.confidence`);
  }
  const mappings = exactObject(object.mappings, ["cwe", "owasp", "attack", "nistCsf"], `${field}.mappings`);
  const explanations = exactObject(object.explanations, ["plain", "developer", "security"], `${field}.explanations`);
  const remediation = exactObject(object.remediation, ["summary", "guidance", "verification"], `${field}.remediation`);
  return {
    id: ruleId(object.id, `${field}.id`),
    version: strictSemver(object.version, `${field}.version`),
    kind: "static_literal_v1",
    title: singleLineText(object.title, `${field}.title`),
    summary: singleLineText(object.summary, `${field}.summary`),
    description: boundedText(object.description, `${field}.description`),
    severity: object.severity as SecurityPackRuleV1["severity"],
    confidence: object.confidence as SecurityPackRuleV1["confidence"],
    category: singleLineText(object.category, `${field}.category`, 128),
    mappings: {
      cwe: mappingList(mappings.cwe, `${field}.mappings.cwe`, CWE_MAPPING),
      owasp: mappingList(mappings.owasp, `${field}.mappings.owasp`, OWASP_MAPPING),
      attack: mappingList(mappings.attack, `${field}.mappings.attack`, ATTACK_MAPPING),
      nistCsf: mappingList(mappings.nistCsf, `${field}.mappings.nistCsf`, NIST_CSF_MAPPING),
    },
    explanations: {
      plain: boundedText(explanations.plain, `${field}.explanations.plain`),
      developer: boundedText(explanations.developer, `${field}.explanations.developer`),
      security: boundedText(explanations.security, `${field}.explanations.security`),
    },
    remediation: {
      summary: singleLineText(remediation.summary, `${field}.remediation.summary`),
      guidance: boundedText(remediation.guidance, `${field}.remediation.guidance`),
      verification: boundedText(remediation.verification, `${field}.remediation.verification`),
    },
    preparedness: textList(object.preparedness, `${field}.preparedness`),
    falsePositiveNotes: textList(object.falsePositiveNotes, `${field}.falsePositiveNotes`),
    matcher: matcherV1(object.matcher, `${field}.matcher`),
  };
}

function parseManifestV1(value: unknown): SecurityPackManifestV1 {
  const object = exactObject(value, [
    "schemaVersion",
    "packId",
    "version",
    "name",
    "summary",
    "license",
    "repository",
    "maintainers",
    "safety",
    "minimumScopeForgeVersion",
    "rules",
  ], "manifest");
  if (object.schemaVersion !== 1) {
    return fail("PACK_MANIFEST_INVALID", "Pack schema version is invalid.", "schemaVersion");
  }
  const licenses = new Set<SecurityPackLicense>(["Apache-2.0", "BSD-3-Clause", "CC-BY-4.0", "MIT"]);
  if (typeof object.license !== "string" || !licenses.has(object.license as SecurityPackLicense)) {
    return fail("PACK_MANIFEST_INVALID", "Pack license is invalid.", "license");
  }
  if (object.safety !== "static") {
    return fail("PACK_MANIFEST_INVALID", "Pack safety mode is invalid.", "safety");
  }
  if (!Array.isArray(object.maintainers) || object.maintainers.length < 1) {
    return fail("PACK_MANIFEST_INVALID", "Pack maintainers list is invalid.", "maintainers");
  }
  if (object.maintainers.length > 10) {
    return fail("PACK_BUDGET_EXCEEDED", "Pack maintainers list exceeds its fixed item limit.", "maintainers");
  }
  const maintainers = object.maintainers.map((entry, index) => githubHandle(entry, `maintainers[${index}]`));
  if (new Set(maintainers).size !== maintainers.length) {
    return fail("PACK_MANIFEST_INVALID", "Pack maintainers list contains duplicates.", "maintainers");
  }
  if (!Array.isArray(object.rules) || object.rules.length < 1) {
    return fail("PACK_MANIFEST_INVALID", "Pack rules list is invalid.", "rules");
  }
  if (object.rules.length > SECURITY_PACK_LIMITS.rulesPerPack) {
    return fail("PACK_BUDGET_EXCEEDED", "Pack rules list exceeds its fixed item limit.", "rules");
  }
  const seenRuleIds = new Set<string>();
  const rules = object.rules.map((entry, index) => {
    const rule = ruleV1(entry, index);
    if (seenRuleIds.has(rule.id)) {
      return fail("PACK_DUPLICATE_RULE", "Pack rule identity is duplicated.", `rules[${index}].id`);
    }
    seenRuleIds.add(rule.id);
    return rule;
  });
  return {
    schemaVersion: 1,
    packId: packId(object.packId, "packId"),
    version: strictSemver(object.version, "version"),
    name: singleLineText(object.name, "name"),
    summary: singleLineText(object.summary, "summary"),
    license: object.license as SecurityPackLicense,
    repository: githubRepositoryUrl(object.repository, "repository"),
    maintainers,
    safety: "static",
    minimumScopeForgeVersion: strictSemver(object.minimumScopeForgeVersion, "minimumScopeForgeVersion"),
    rules,
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function sameFileIdentity(left: Stats, right: Stats): boolean {
  return left.isFile()
    && right.isFile()
    && left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.nlink === 1
    && right.nlink === 1;
}

function isContained(canonicalRoot: string, candidate: string): boolean {
  const child = relative(canonicalRoot, candidate);
  return child !== "" && child !== ".." && !child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(child);
}

async function safeLstat(path: string): Promise<Stats> {
  try {
    return await lstat(path);
  } catch {
    return fail("PACK_PATH_INVALID", "Security Pack path cannot be inspected.");
  }
}

export async function readVerifiedManifestBytes(
  manifestPath: string,
  canonicalRoot: string,
  manifestStat: Stats,
  maximumBytes: number,
): Promise<Uint8Array> {
  let canonicalManifest: string;
  try {
    canonicalManifest = await realpath(manifestPath);
  } catch {
    return fail("PACK_PATH_INVALID", "Pack manifest identity could not be verified.");
  }
  if (!isContained(canonicalRoot, canonicalManifest)) {
    return fail("PACK_PATH_INVALID", "Pack manifest must remain inside the pack root.");
  }

  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  let handle;
  try {
    handle = await open(canonicalManifest, constants.O_RDONLY | noFollow);
  } catch {
    return fail("PACK_PATH_INVALID", "Pack manifest could not be opened safely.");
  }

  try {
    const openedStat = await handle.stat();
    if (!sameFileIdentity(manifestStat, openedStat)) {
      return fail("PACK_PATH_INVALID", "Pack manifest identity changed during validation.");
    }
    const bytes = Buffer.allocUnsafe(maximumBytes + 1);
    let total = 0;
    while (total < bytes.length) {
      const result = await handle.read(bytes, total, bytes.length - total, total);
      if (result.bytesRead === 0) break;
      total += result.bytesRead;
    }
    if (total > maximumBytes) {
      return fail("PACK_MANIFEST_TOO_LARGE", "Pack manifest exceeds the fixed byte limit.");
    }
    const completedStat = await handle.stat();
    if (!sameFileIdentity(openedStat, completedStat) || !sameFileIdentity(manifestStat, completedStat)) {
      return fail("PACK_PATH_INVALID", "Pack manifest identity changed during validation.");
    }
    return bytes.subarray(0, total);
  } catch (error) {
    if (error instanceof SecurityPackError) throw error;
    return fail("PACK_PATH_INVALID", "Pack manifest could not be read safely.");
  } finally {
    await handle.close().catch(() => undefined);
  }
}

export async function loadSecurityPackManifest(packDirectory: string): Promise<LoadedSecurityPack> {
  if (typeof packDirectory !== "string" || packDirectory.length === 0) {
    return fail("PACK_PATH_INVALID", "Pack root path is invalid.");
  }
  const absolute = resolve(packDirectory);
  const rootStat = await safeLstat(absolute);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    return fail("PACK_PATH_INVALID", "Pack root must be a real directory.");
  }
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(absolute);
  } catch {
    return fail("PACK_PATH_INVALID", "Pack root identity could not be verified.");
  }
  const manifestPath = join(canonicalRoot, MANIFEST_NAME);
  const manifestStat = await safeLstat(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
    return fail("PACK_PATH_INVALID", "Pack manifest must be a regular file.");
  }
  if (manifestStat.nlink !== 1) {
    return fail("PACK_PATH_INVALID", "Pack manifest must not be hard-linked.");
  }
  if (manifestStat.size > SECURITY_PACK_LIMITS.manifestBytes) {
    return fail("PACK_MANIFEST_TOO_LARGE", "Pack manifest exceeds the fixed byte limit.");
  }
  const bytes = await readVerifiedManifestBytes(
    manifestPath,
    canonicalRoot,
    manifestStat,
    SECURITY_PACK_LIMITS.manifestBytes,
  );
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail("PACK_MANIFEST_INVALID", "Pack manifest is not valid UTF-8.");
  }
  const duplicateCheck = parseDocument(text, { schema: "json", uniqueKeys: true });
  if (duplicateCheck.errors.length > 0) {
    return fail("PACK_MANIFEST_INVALID", "Pack manifest is not strict unique-key JSON.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("PACK_MANIFEST_INVALID", "Pack manifest is not strict JSON.");
  }
  const manifest = deepFreeze(parseManifestV1(raw));
  return Object.freeze({ packDirectory: canonicalRoot, manifestPath, manifest });
}

function semverTuple(value: string): readonly [bigint, bigint, bigint] {
  const match = STRICT_SEMVER.exec(value);
  if (!match) {
    return fail("PACK_IDENTITY_INVALID", "ScopeForge semantic version is invalid.", "currentScopeForgeVersion");
  }
  return [BigInt(match[1]!), BigInt(match[2]!), BigInt(match[3]!)];
}

export function assertSecurityPackCompatibility(
  manifest: SecurityPackManifestV1,
  currentScopeForgeVersion: string,
): void {
  const required = semverTuple(strictSemver(
    manifest.minimumScopeForgeVersion,
    "minimumScopeForgeVersion",
  ));
  const current = semverTuple(strictSemver(
    currentScopeForgeVersion,
    "currentScopeForgeVersion",
  ));
  for (let index = 0; index < required.length; index += 1) {
    if (current[index]! > required[index]!) return;
    if (current[index]! < required[index]!) {
      return fail(
        "PACK_IDENTITY_INVALID",
        "Pack requires a newer ScopeForge version.",
        "minimumScopeForgeVersion",
      );
    }
  }
}
