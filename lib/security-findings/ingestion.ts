import type { Json } from "@/lib/database.types";
import {
  assetRef,
  type EvidenceRecord,
  type SecurityFinding,
} from "@/packages/security-domain";
import type {
  FindingIngestionBatch,
  PreparedFindingIngestion,
} from "./types";

const LIMITS = Object.freeze({
  id: 256,
  sourceId: 256,
  sourceVersion: 128,
  scanRunRef: 256,
  ruleRef: 512,
  title: 240,
  description: 8_192,
  locationBytes: 8_192,
  taxonomyBytes: 16_384,
  remediationBytes: 16_384,
  evidenceSummary: 4_096,
});

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function assertText(value: string, name: string, maximum: number): void {
  if (value.trim().length === 0 || value.length > maximum) {
    throw new Error(`${name} must contain between 1 and ${maximum} characters.`);
  }
}

function assertOptionalText(value: string | undefined, name: string, maximum: number): void {
  if (value === undefined) return;
  assertText(value, name, maximum);
}

function assertJsonBound(value: unknown, name: string, maximumBytes: number): void {
  const serialized = JSON.stringify(value);
  if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > maximumBytes) {
    throw new Error(`${name} exceeds the hosted finding payload bound.`);
  }
}

function assertRuntimeFinding(finding: SecurityFinding, expectedAssetId: string): void {
  assertText(String(finding.id), "Finding id", LIMITS.id);
  if (finding.source.kind !== "deterministic-runtime-scanner") {
    throw new Error("Phase 5A hosted ingestion accepts deterministic runtime findings only.");
  }
  assertText(finding.source.sourceId, "Finding source id", LIMITS.sourceId);
  assertOptionalText(finding.source.sourceVersion, "Finding source version", LIMITS.sourceVersion);
  assertOptionalText(
    finding.source.scanRunRef ? String(finding.source.scanRunRef) : undefined,
    "Finding scan run reference",
    LIMITS.scanRunRef,
  );
  assertText(String(finding.rule), "Finding rule reference", LIMITS.ruleRef);
  assertText(finding.title, "Finding title", LIMITS.title);
  assertText(finding.description, "Finding description", LIMITS.description);
  if (finding.provenance.kind !== "scanner-derived") {
    throw new Error("Runtime finding provenance must be scanner-derived.");
  }
  if (finding.validation !== "runtime_observed" && finding.validation !== "runtime_validated") {
    throw new Error("Runtime finding validation state is incompatible with hosted ingestion.");
  }
  if (!finding.assetRef || String(finding.assetRef) !== String(assetRef(expectedAssetId))) {
    throw new Error("Runtime finding asset reference does not match the hosted asset.");
  }
  if (finding.evidenceRefs.length === 0) {
    throw new Error("Runtime findings must reference observed evidence.");
  }
  for (const ref of finding.evidenceRefs) {
    assertText(String(ref), "Finding evidence reference", LIMITS.id);
  }
  if (finding.location !== undefined) {
    assertJsonBound(finding.location, "Finding location", LIMITS.locationBytes);
  }
  assertJsonBound(finding.taxonomy, "Finding taxonomy", LIMITS.taxonomyBytes);
  if (finding.remediation !== undefined) {
    assertJsonBound(finding.remediation, "Finding remediation", LIMITS.remediationBytes);
  }
}

function assertRuntimeEvidence(record: EvidenceRecord): void {
  assertText(String(record.id), "Evidence id", LIMITS.id);
  if (record.kind !== "http-observation" && record.kind !== "tls-observation") {
    throw new Error("Runtime evidence kind must be an HTTP or TLS observation.");
  }
  if (record.provenance.kind !== "observed") {
    throw new Error("Runtime evidence provenance must be observed.");
  }
  if (record.classification !== "public") {
    throw new Error("Runtime evidence must be public before hosted persistence.");
  }
  assertText(record.summary, "Evidence summary", LIMITS.evidenceSummary);
  if (record.artifactRef !== undefined) {
    throw new Error("Runtime evidence artifact references are not persisted in Phase 5A.");
  }
}

function serializeFinding(finding: SecurityFinding): Json {
  return {
    finding_id: String(finding.id),
    source_kind: finding.source.kind,
    source_id: finding.source.sourceId,
    source_version: finding.source.sourceVersion ?? null,
    scan_run_ref: finding.source.scanRunRef ? String(finding.source.scanRunRef) : null,
    rule_ref: String(finding.rule),
    title: finding.title,
    description: finding.description,
    severity: finding.severity,
    confidence: finding.confidence,
    validation_state: finding.validation,
    provenance_kind: finding.provenance.kind,
    location: finding.location === undefined ? null : toJson(finding.location),
    taxonomy: toJson(finding.taxonomy),
    remediation: finding.remediation === undefined ? null : toJson(finding.remediation),
    evidence_refs: finding.evidenceRefs.map(String),
  };
}

function serializeEvidence(record: EvidenceRecord): Json {
  return {
    evidence_id: String(record.id),
    kind: record.kind,
    provenance_kind: record.provenance.kind,
    summary: record.summary,
    classification: record.classification,
    artifact_ref: null,
  };
}

function dedupeRows(
  rows: readonly Json[],
  idField: string,
  kind: "finding" | "evidence",
): readonly Json[] {
  const unique = new Map<string, { serialized: string; row: Json }>();
  for (const row of rows) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw new Error(`Invalid ${kind} row.`);
    }
    const idValue = row[idField];
    if (typeof idValue !== "string") throw new Error(`Invalid ${kind} identity.`);
    const serialized = JSON.stringify(row);
    const existing = unique.get(idValue);
    if (existing && existing.serialized !== serialized) {
      throw new Error(`Conflicting duplicate ${kind} identity: ${idValue}`);
    }
    if (!existing) unique.set(idValue, { serialized, row });
  }
  return Object.freeze([...unique.values()].map(({ row }) => row));
}

export function prepareFindingIngestionBatch(
  input: FindingIngestionBatch,
): PreparedFindingIngestion {
  assertText(input.workspaceId, "Workspace id", LIMITS.id);
  assertText(input.assetId, "Asset id", LIMITS.id);
  assertText(input.scanJobId, "Scan job id", LIMITS.id);
  if (Number.isNaN(input.observedAt.getTime())) {
    throw new Error("Observed timestamp must be valid.");
  }

  for (const finding of input.findings) assertRuntimeFinding(finding, input.assetId);
  for (const record of input.evidence) assertRuntimeEvidence(record);

  const evidenceRows = dedupeRows(input.evidence.map(serializeEvidence), "evidence_id", "evidence");
  const evidenceIds = new Set(evidenceRows.map((row) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) return "";
    return String(row.evidence_id);
  }));
  for (const finding of input.findings) {
    for (const ref of finding.evidenceRefs) {
      if (!evidenceIds.has(String(ref))) {
        throw new Error(`Finding references unavailable evidence: ${String(ref)}`);
      }
    }
  }

  const findingRows = dedupeRows(input.findings.map(serializeFinding), "finding_id", "finding");
  return Object.freeze({
    workspaceId: input.workspaceId,
    assetId: input.assetId,
    scanJobId: input.scanJobId,
    observedAt: input.observedAt.toISOString(),
    findings: toJson(findingRows),
    evidence: toJson(evidenceRows),
  });
}
