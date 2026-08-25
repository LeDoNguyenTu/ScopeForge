import { createHash } from "node:crypto";

import { normalizeAssetTarget } from "@/lib/assets/normalize-target";
import type {
  HostedPhase3EnvelopeV1,
  HostedPhase3FindingLocationV1,
  HostedPhase3FindingV1,
} from "@/packages/scanner-output/hosted/types";
import {
  isAllowedPhase3ScannerDescriptor,
  Phase3ImportValidationError,
  resolvePhase3Source,
} from "./source-registry";

export { Phase3ImportValidationError } from "./source-registry";

const RUN_REF = /^sfh1:[a-f0-9]{64}$/;
const FINGERPRINT = /^(?:sf1|sfs1):[a-f0-9]{64}$/;
const SAFE_SCANNERS = 32;
const MAX_FINDINGS = 500;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_INVENTORY_COUNT = 1_000_000;
const MAX_INVENTORY_BYTES = 10 * 1024 * 1024 * 1024;
const MAX_SCANNER_ERRORS = 100_000;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function invalid(message: string): never {
  throw new Phase3ImportValidationError("PHASE3_IMPORT_INVALID", message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainObject(value)) invalid(`${label} must be an object.`);
  return value;
}

function exactKeys(object: Record<string, unknown>, keys: readonly string[], label: string): void {
  const expected = new Set(keys);
  const actual = Object.keys(object);
  if (actual.length !== expected.size || actual.some((key) => !expected.has(key))) {
    invalid(`${label} contains unsupported fields.`);
  }
}

function requiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") invalid(`${label} must be a string.`);
  const text = value as string;
  if (text.length === 0 || text.length > maxLength || CONTROL_CHARACTERS.test(text)) {
    invalid(`${label} is outside the supported hosted boundary.`);
  }
  return text;
}

function nonNegativeInteger(value: unknown, label: string, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
    invalid(`${label} must be a bounded non-negative integer.`);
  }
  return value as number;
}

function positiveInteger(value: unknown, label: string, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    invalid(`${label} must be a bounded positive integer.`);
  }
  return value as number;
}

function canonicalIsoTimestamp(value: unknown, label: string): string {
  const text = requiredString(value, label, 64);
  const date = new Date(text);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== text) {
    invalid(`${label} must be a canonical ISO timestamp.`);
  }
  return text;
}

function sortedUniqueStrings(
  value: unknown,
  label: string,
  options: { maxItems: number; maxItemLength: number },
): string[] {
  if (!Array.isArray(value) || value.length > options.maxItems) {
    invalid(`${label} exceeds the supported hosted boundary.`);
  }
  const items = value.map((item, index) => requiredString(item, `${label}[${index}]`, options.maxItemLength));
  return [...new Set(items)].sort();
}

function canonicalRepositoryUrl(value: unknown): string {
  const raw = requiredString(value, "repository.canonicalUrl", 2048);
  let normalized: string;
  try {
    normalized = normalizeAssetTarget(raw, "repository").canonicalTarget;
  } catch {
    invalid("repository.canonicalUrl must be a supported public GitHub repository URL.");
  }
  if (normalized !== raw) {
    invalid("repository.canonicalUrl must already be in canonical ScopeForge repository form.");
  }
  return normalized;
}

function canonicalRepositoryPath(value: unknown): string {
  const path = requiredString(value, "finding.location.path", 2048);
  const segments = path.split("/");
  if (
    path.startsWith("/")
    || path.includes("\\")
    || /^[A-Za-z]:\//.test(path)
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    invalid("Finding paths must be canonical repository-relative paths.");
  }
  return path;
}

function validateLocation(value: unknown, scanner: string): HostedPhase3FindingLocationV1 {
  const location = objectValue(value, "finding.location");
  const keys = scanner === "secrets"
    ? ["path", "line"]
    : ["path", "line", "startColumn", "endColumn"];

  if (scanner === "secrets") {
    exactKeys(location, keys, "finding.location");
    return {
      path: canonicalRepositoryPath(location.path),
      line: positiveInteger(location.line, "finding.location.line"),
    };
  }

  const actualKeys = Object.keys(location);
  const supported = new Set(keys);
  if (actualKeys.some((key) => !supported.has(key)) || !actualKeys.includes("path") || !actualKeys.includes("line")) {
    invalid("finding.location contains unsupported fields.");
  }

  const result: HostedPhase3FindingLocationV1 = {
    path: canonicalRepositoryPath(location.path),
    line: positiveInteger(location.line, "finding.location.line"),
  };

  const hasStart = location.startColumn !== undefined;
  const hasEnd = location.endColumn !== undefined;
  if (hasStart !== hasEnd) invalid("Finding columns must be supplied as a complete pair.");
  if (hasStart) {
    const startColumn = positiveInteger(location.startColumn, "finding.location.startColumn");
    const endColumn = positiveInteger(location.endColumn, "finding.location.endColumn");
    if (endColumn < startColumn) invalid("Finding column range is invalid.");
    result.startColumn = startColumn;
    result.endColumn = endColumn;
  }
  return result;
}

function validateTaxonomy(value: unknown): HostedPhase3FindingV1["taxonomy"] {
  const taxonomy = objectValue(value, "finding.taxonomy");
  exactKeys(taxonomy, ["cwe", "owasp", "references"], "finding.taxonomy");
  return {
    cwe: sortedUniqueStrings(taxonomy.cwe, "finding.taxonomy.cwe", { maxItems: 32, maxItemLength: 64 }),
    owasp: sortedUniqueStrings(taxonomy.owasp, "finding.taxonomy.owasp", { maxItems: 32, maxItemLength: 64 }),
    references: sortedUniqueStrings(taxonomy.references, "finding.taxonomy.references", { maxItems: 20, maxItemLength: 512 }),
  };
}

function validateRemediation(value: unknown): HostedPhase3FindingV1["remediation"] {
  const remediation = objectValue(value, "finding.remediation");
  exactKeys(remediation, ["summary", "guidance", "verification"], "finding.remediation");
  const result = {
    summary: requiredString(remediation.summary, "finding.remediation.summary", 2000),
    guidance: requiredString(remediation.guidance, "finding.remediation.guidance", 7000),
    verification: requiredString(remediation.verification, "finding.remediation.verification", 3000),
  };
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 14_000) {
    invalid("finding.remediation exceeds the hosted storage boundary.");
  }
  return result;
}

function validateFinding(value: unknown, scannerDescriptors: ReadonlySet<string>): HostedPhase3FindingV1 {
  const finding = objectValue(value, "finding");
  exactKeys(
    finding,
    [
      "fingerprint",
      "scanner",
      "ruleId",
      "ruleVersion",
      "title",
      "description",
      "severity",
      "confidence",
      "validation",
      "location",
      "evidence",
      "taxonomy",
      "remediation",
    ],
    "finding",
  );

  const fingerprint = requiredString(finding.fingerprint, "finding.fingerprint", 80);
  if (!FINGERPRINT.test(fingerprint)) invalid("finding.fingerprint is not a supported ScopeForge fingerprint.");

  const scanner = requiredString(finding.scanner, "finding.scanner", 32);
  const ruleId = requiredString(finding.ruleId, "finding.ruleId", 256);
  const ruleVersion = requiredString(finding.ruleVersion, "finding.ruleVersion", 128);
  resolvePhase3Source(scanner, ruleId, ruleVersion);
  if (!scannerDescriptors.has(`${scanner}@1.0.0`)) {
    invalid("The finding scanner was not declared by this hosted scan envelope.");
  }

  const severity = finding.severity;
  if (!(["critical", "high", "medium", "low", "info"] as const).includes(severity as never)) {
    invalid("finding.severity is invalid.");
  }
  const confidence = finding.confidence;
  if (!(["high", "medium", "low"] as const).includes(confidence as never)) {
    invalid("finding.confidence is invalid.");
  }
  const validation = finding.validation;
  if (validation !== "static_confirmed" && validation !== "unvalidated") {
    invalid("finding.validation is outside the passive hosted import boundary.");
  }

  const evidence = objectValue(finding.evidence, "finding.evidence");
  exactKeys(evidence, ["summary"], "finding.evidence");

  return {
    fingerprint,
    scanner,
    ruleId,
    ruleVersion,
    title: requiredString(finding.title, "finding.title", 240),
    description: requiredString(finding.description, "finding.description", 8192),
    severity: severity as HostedPhase3FindingV1["severity"],
    confidence: confidence as HostedPhase3FindingV1["confidence"],
    validation,
    location: validateLocation(finding.location, scanner),
    evidence: {
      summary: requiredString(evidence.summary, "finding.evidence.summary", 4096),
    },
    taxonomy: validateTaxonomy(finding.taxonomy),
    remediation: validateRemediation(finding.remediation),
  };
}

function compareFindings(left: HostedPhase3FindingV1, right: HostedPhase3FindingV1): number {
  const values: Array<[string, string]> = [
    [left.fingerprint, right.fingerprint],
    [left.scanner, right.scanner],
    [left.ruleId, right.ruleId],
    [left.ruleVersion, right.ruleVersion],
    [left.location.path, right.location.path],
  ];
  for (const [leftValue, rightValue] of values) {
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }
  return left.location.line - right.location.line;
}

function expectedRunRef(payload: Omit<HostedPhase3EnvelopeV1, "runRef">): string {
  const digest = createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
  return `sfh1:${digest}`;
}

export function validateHostedPhase3Envelope(value: unknown): HostedPhase3EnvelopeV1 {
  const envelope = objectValue(value, "Hosted Phase 3 envelope");
  exactKeys(
    envelope,
    ["schemaVersion", "tool", "repository", "runRef", "scan", "inventory", "findings"],
    "Hosted Phase 3 envelope",
  );
  if (envelope.schemaVersion !== 1) invalid("Only hosted Phase 3 schema version 1 is supported.");

  const tool = objectValue(envelope.tool, "tool");
  exactKeys(tool, ["name", "version"], "tool");
  if (tool.name !== "ScopeForge") invalid("Hosted imports must be produced by ScopeForge.");
  const toolVersion = requiredString(tool.version, "tool.version", 64);

  const repository = objectValue(envelope.repository, "repository");
  exactKeys(repository, ["canonicalUrl"], "repository");
  const repositoryUrl = canonicalRepositoryUrl(repository.canonicalUrl);

  const suppliedRunRef = requiredString(envelope.runRef, "runRef", 69);
  if (!RUN_REF.test(suppliedRunRef)) invalid("runRef is not a supported ScopeForge hosted run reference.");

  const scan = objectValue(envelope.scan, "scan");
  exactKeys(scan, ["startedAt", "durationMs", "scanners", "scannerErrorCount"], "scan");
  const scanners = sortedUniqueStrings(scan.scanners, "scan.scanners", {
    maxItems: SAFE_SCANNERS,
    maxItemLength: 128,
  });
  if (scanners.length === 0 || scanners.some((descriptor) => !isAllowedPhase3ScannerDescriptor(descriptor))) {
    invalid("scan.scanners contains an unreviewed ScopeForge scanner descriptor.");
  }
  const scannerDescriptors = new Set(scanners);

  const inventory = objectValue(envelope.inventory, "inventory");
  exactKeys(inventory, ["filesAnalyzed", "filesSkipped", "totalBytes"], "inventory");

  if (!Array.isArray(envelope.findings) || envelope.findings.length > MAX_FINDINGS) {
    invalid("findings exceeds the 500-finding hosted boundary.");
  }
  const findings = envelope.findings
    .map((finding) => validateFinding(finding, scannerDescriptors))
    .sort(compareFindings);

  const payload: Omit<HostedPhase3EnvelopeV1, "runRef"> = {
    schemaVersion: 1,
    tool: {
      name: "ScopeForge",
      version: toolVersion,
    },
    repository: {
      canonicalUrl: repositoryUrl,
    },
    scan: {
      startedAt: canonicalIsoTimestamp(scan.startedAt, "scan.startedAt"),
      durationMs: nonNegativeInteger(scan.durationMs, "scan.durationMs", MAX_DURATION_MS),
      scanners,
      scannerErrorCount: nonNegativeInteger(scan.scannerErrorCount, "scan.scannerErrorCount", MAX_SCANNER_ERRORS),
    },
    inventory: {
      filesAnalyzed: nonNegativeInteger(inventory.filesAnalyzed, "inventory.filesAnalyzed", MAX_INVENTORY_COUNT),
      filesSkipped: nonNegativeInteger(inventory.filesSkipped, "inventory.filesSkipped", MAX_INVENTORY_COUNT),
      totalBytes: nonNegativeInteger(inventory.totalBytes, "inventory.totalBytes", MAX_INVENTORY_BYTES),
    },
    findings,
  };

  const computedRunRef = expectedRunRef(payload);
  if (computedRunRef !== suppliedRunRef) {
    throw new Phase3ImportValidationError(
      "PHASE3_RUN_REF_CONFLICT",
      "The hosted run reference does not match the validated import payload.",
    );
  }

  return {
    ...payload,
    runRef: computedRunRef,
  };
}
