import { createHash } from "node:crypto";
import {
  evidenceId,
  ruleRef,
  securityFindingId,
  type AssetRef,
  type EvidenceRecord,
  type SecurityFinding,
} from "@/packages/security-domain";
import { CORS_ORIGIN_POLICY_PROFILE } from "./contracts";
import type { ActiveRuntimeRuleMatch } from "./rules/types";

const ACTIVE_RUNTIME_SOURCE_ID = "scopeforge:runtime-validator";
const ACTIVE_RUNTIME_SOURCE_VERSION = `${CORS_ORIGIN_POLICY_PROFILE.id}@${CORS_ORIGIN_POLICY_PROFILE.version}`;
const MAX_EVIDENCE_SUMMARY_LENGTH = 4_096;

function stableActiveRuntimeDigest(
  assetRef: AssetRef,
  match: ActiveRuntimeRuleMatch,
): string {
  return createHash("sha256")
    .update(String(assetRef), "utf8")
    .update("\u0000", "utf8")
    .update(match.ruleId, "utf8")
    .update("\u0000", "utf8")
    .update(ACTIVE_RUNTIME_SOURCE_VERSION, "utf8")
    .update("\u0000", "utf8")
    .update(match.observationKey, "utf8")
    .digest("hex");
}

function activeRuntimeEvidenceId(
  assetRef: AssetRef,
  match: ActiveRuntimeRuleMatch,
) {
  return evidenceId(`active-runtime-evidence:${stableActiveRuntimeDigest(assetRef, match)}`);
}

export function mapActiveRuntimeRuleMatchToEvidence(input: {
  assetRef: AssetRef;
  match: ActiveRuntimeRuleMatch;
}): EvidenceRecord {
  return {
    id: activeRuntimeEvidenceId(input.assetRef, input.match),
    kind: input.match.evidenceKind,
    provenance: { kind: "observed" },
    summary: input.match.evidenceSummary.slice(0, MAX_EVIDENCE_SUMMARY_LENGTH),
    classification: input.match.classification,
  };
}

export function mapActiveRuntimeRuleMatchToSecurityFinding(input: {
  assetRef: AssetRef;
  match: ActiveRuntimeRuleMatch;
}): SecurityFinding {
  const digest = stableActiveRuntimeDigest(input.assetRef, input.match);
  const mappedEvidenceId = activeRuntimeEvidenceId(input.assetRef, input.match);

  return {
    id: securityFindingId(`active-runtime:${digest}`),
    source: {
      kind: "deterministic-runtime-scanner",
      sourceId: ACTIVE_RUNTIME_SOURCE_ID,
      sourceVersion: ACTIVE_RUNTIME_SOURCE_VERSION,
    },
    rule: ruleRef(`runtime-validator-rule:${input.match.ruleId}@${ACTIVE_RUNTIME_SOURCE_VERSION}`),
    title: input.match.title,
    description: input.match.description,
    severity: input.match.severity,
    confidence: input.match.confidence,
    validation: "runtime_validated",
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
