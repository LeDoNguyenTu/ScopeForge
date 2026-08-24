import { createHash } from "node:crypto";
import {
  evidenceId,
  ruleRef,
  securityFindingId,
  type AssetRef,
  type EvidenceRecord,
  type SecurityFinding,
} from "@/packages/security-domain";
import type { RuntimeRuleMatch } from "./rules/types";

const RUNTIME_SOURCE_ID = "scopeforge:runtime-observer";
const RUNTIME_SOURCE_VERSION = "0.1";
const MAX_EVIDENCE_SUMMARY_LENGTH = 4_096;

function stableRuntimeDigest(assetRef: AssetRef, match: RuntimeRuleMatch): string {
  return createHash("sha256")
    .update(String(assetRef), "utf8")
    .update("\u0000", "utf8")
    .update(match.ruleId, "utf8")
    .update("\u0000", "utf8")
    .update(RUNTIME_SOURCE_VERSION, "utf8")
    .update("\u0000", "utf8")
    .update(match.observationKey, "utf8")
    .digest("hex");
}

function boundedEvidenceSummary(match: RuntimeRuleMatch): string {
  return match.evidenceSummary.slice(0, MAX_EVIDENCE_SUMMARY_LENGTH);
}

function runtimeEvidenceDigest(assetRef: AssetRef, match: RuntimeRuleMatch): string {
  return createHash("sha256")
    .update(stableRuntimeDigest(assetRef, match), "utf8")
    .update("\u0000", "utf8")
    .update(match.evidenceKind, "utf8")
    .update("\u0000", "utf8")
    .update(match.classification, "utf8")
    .update("\u0000", "utf8")
    .update(boundedEvidenceSummary(match), "utf8")
    .digest("hex");
}

function runtimeEvidenceId(assetRef: AssetRef, match: RuntimeRuleMatch) {
  return evidenceId(`runtime-evidence:${runtimeEvidenceDigest(assetRef, match)}`);
}

export function mapRuntimeRuleMatchToEvidence(input: {
  assetRef: AssetRef;
  match: RuntimeRuleMatch;
}): EvidenceRecord {
  return {
    id: runtimeEvidenceId(input.assetRef, input.match),
    kind: input.match.evidenceKind,
    provenance: { kind: "observed" },
    summary: boundedEvidenceSummary(input.match),
    classification: input.match.classification,
  };
}

export function mapRuntimeRuleMatchToSecurityFinding(input: {
  assetRef: AssetRef;
  match: RuntimeRuleMatch;
}): SecurityFinding {
  const digest = stableRuntimeDigest(input.assetRef, input.match);
  const mappedEvidenceId = runtimeEvidenceId(input.assetRef, input.match);

  return {
    id: securityFindingId(`runtime:${digest}`),
    source: {
      kind: "deterministic-runtime-scanner",
      sourceId: RUNTIME_SOURCE_ID,
      sourceVersion: RUNTIME_SOURCE_VERSION,
    },
    rule: ruleRef(`runtime-rule:${input.match.ruleId}@${RUNTIME_SOURCE_VERSION}`),
    title: input.match.title,
    description: input.match.description,
    severity: input.match.severity,
    confidence: input.match.confidence,
    validation: "runtime_observed",
    provenance: { kind: "scanner-derived" },
    evidenceRefs: [mappedEvidenceId],
    assetRef: input.assetRef,
    taxonomy: {
      cwe: [],
      owasp: [],
      references: [],
    },
    lifecycle: "open",
    remediation: input.match.remediation,
  };
}
