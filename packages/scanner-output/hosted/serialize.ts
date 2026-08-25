import { createHash } from "node:crypto";
import type { Finding, ScanResult, Validation } from "../../scanner-core/findings/types";
import type {
  HostedPhase3EnvelopeV1,
  HostedPhase3FindingLocationV1,
  HostedPhase3FindingV1,
  HostedPhase3Validation,
} from "./types";

const MAX_HOSTED_FINDINGS = 500;

export interface SerializeHostedScanResultOptions {
  toolVersion: string;
  repositoryUrl: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalRepositoryUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Hosted ScopeForge export requires a valid GitHub repository URL.");
  }

  if (
    url.protocol !== "https:"
    || url.hostname.toLowerCase() !== "github.com"
    || url.username
    || url.password
    || url.port
    || url.search
    || url.hash
  ) {
    throw new Error("Hosted ScopeForge export requires a public GitHub HTTPS repository URL.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) {
    throw new Error("Hosted ScopeForge export requires a GitHub repository URL in owner/repository form.");
  }
  const owner = segments[0] as string;
  const repository = (segments[1] as string).replace(/\.git$/i, "");
  if (!owner || !repository) {
    throw new Error("Hosted ScopeForge export requires a GitHub repository URL in owner/repository form.");
  }

  return `https://github.com/${owner}/${repository}`;
}

function hostedPath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
  const segments = normalized.split("/");
  if (
    normalized === ""
    || normalized.startsWith("/")
    || /^[A-Za-z]:\//.test(normalized)
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error("Hosted ScopeForge export requires canonical repository-relative finding paths.");
  }
  return normalized;
}

function normalizeHostedValidation(validation: Validation): HostedPhase3Validation {
  switch (validation) {
    case "static_confirmed":
    case "dependency_confirmed":
      return "static_confirmed";
    case "heuristic":
    case "informational":
      return "unvalidated";
  }
}

function locationFor(finding: Finding): HostedPhase3FindingLocationV1 {
  const location: HostedPhase3FindingLocationV1 = {
    path: hostedPath(finding.location.file),
    line: finding.location.startLine,
  };

  if (finding.scanner !== "secrets") {
    location.startColumn = finding.location.startColumn;
    location.endColumn = finding.location.endColumn;
  }

  return location;
}

function fingerprintFor(
  finding: Finding,
  location: HostedPhase3FindingLocationV1,
): string {
  if (finding.scanner !== "secrets") return finding.fingerprint;

  const identity = [
    "scopeforge-hosted-secret-fingerprint-v1",
    finding.ruleId.trim().toLowerCase(),
    finding.ruleVersion.trim(),
    location.path,
    String(location.line),
  ].join("\n");

  return `sfs1:${sha256(identity)}`;
}

function evidenceSummaryFor(finding: Finding): string {
  if (finding.scanner === "secrets") {
    return `Detected by ${finding.ruleId}.`;
  }
  return finding.evidence.summary;
}

function mapFinding(finding: Finding): HostedPhase3FindingV1 {
  const location = locationFor(finding);
  return {
    fingerprint: fingerprintFor(finding, location),
    scanner: finding.scanner,
    ruleId: finding.ruleId,
    ruleVersion: finding.ruleVersion,
    title: finding.title,
    description: finding.description,
    severity: finding.severity,
    confidence: finding.confidence,
    validation: normalizeHostedValidation(finding.validation),
    location,
    evidence: {
      summary: evidenceSummaryFor(finding),
    },
    taxonomy: {
      cwe: [...finding.cwe].sort(),
      owasp: [...finding.owasp].sort(),
      references: [...finding.references].sort(),
    },
    remediation: {
      summary: finding.remediation.summary,
      guidance: finding.remediation.guidance,
      verification: finding.remediation.verification,
    },
  };
}

function compareHostedFindings(left: HostedPhase3FindingV1, right: HostedPhase3FindingV1): number {
  const fields: Array<[string, string]> = [
    [left.fingerprint, right.fingerprint],
    [left.scanner, right.scanner],
    [left.ruleId, right.ruleId],
    [left.ruleVersion, right.ruleVersion],
    [left.location.path, right.location.path],
  ];
  for (const [leftValue, rightValue] of fields) {
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }
  return left.location.line - right.location.line;
}

function runRefFor(payload: Omit<HostedPhase3EnvelopeV1, "runRef">): string {
  return `sfh1:${sha256(JSON.stringify(payload))}`;
}

export function serializeHostedScanResult(
  result: ScanResult,
  options: SerializeHostedScanResultOptions,
): string {
  if (result.findings.length > MAX_HOSTED_FINDINGS) {
    throw new Error("Hosted ScopeForge imports support at most 500 findings.");
  }

  const payload: Omit<HostedPhase3EnvelopeV1, "runRef"> = {
    schemaVersion: 1,
    tool: {
      name: "ScopeForge",
      version: options.toolVersion,
    },
    repository: {
      canonicalUrl: canonicalRepositoryUrl(options.repositoryUrl),
    },
    scan: {
      startedAt: result.scan.startedAt,
      durationMs: result.scan.durationMs,
      scanners: [...result.scan.scanners].sort(),
      scannerErrorCount: result.errors.length,
    },
    inventory: {
      filesAnalyzed: result.inventory.filesAnalyzed,
      filesSkipped: result.inventory.filesSkipped,
      totalBytes: result.inventory.totalBytes,
    },
    findings: result.findings.map(mapFinding).sort(compareHostedFindings),
  };

  const envelope: HostedPhase3EnvelopeV1 = {
    ...payload,
    runRef: runRefFor(payload),
  };

  return `${JSON.stringify(envelope, null, 2)}\n`;
}