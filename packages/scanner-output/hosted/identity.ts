import { createHash } from "node:crypto";
import type { HostedEvidenceClassification, HostedEvidenceKind } from "./types";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export interface HostedFindingIdentityInput {
  repositoryAssetId: string;
  fingerprint: string;
  scanner: string;
  ruleId: string;
  ruleVersion: string;
}

export function createHostedFindingIdentity(input: HostedFindingIdentityInput): string {
  const identity = [
    "scopeforge-hosted-phase3-finding-v1",
    input.repositoryAssetId.trim().toLowerCase(),
    input.fingerprint.trim().toLowerCase(),
    input.scanner.trim().toLowerCase(),
    input.ruleId.trim().toLowerCase(),
    input.ruleVersion.trim(),
  ].join("\n");

  return `phase3:${sha256(identity)}`;
}

export interface HostedEvidenceIdentityInput {
  findingId: string;
  kind: HostedEvidenceKind;
  classification: HostedEvidenceClassification;
  summary: string;
}

export function createHostedEvidenceIdentity(input: HostedEvidenceIdentityInput): string {
  const identity = [
    "scopeforge-hosted-phase3-evidence-v1",
    input.findingId,
    input.kind,
    input.classification,
    input.summary.trim(),
  ].join("\n");

  return `phase3-evidence:${sha256(identity)}`;
}
