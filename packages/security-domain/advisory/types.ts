import type { AdvisoryRecordId, SecurityFindingId } from "../common/identifiers";
import type { ContentClassification } from "../evidence/types";
import type { RiskRelationship } from "../relationships/types";

export type AdvisoryPurpose =
  | "explain-finding"
  | "correlate-findings"
  | "draft-security-story"
  | "clarify-remediation"
  | "suggest-follow-up-checks"
  | "assist-rule-author";

export type AdvisoryResultKind =
  | "explanation"
  | "inference"
  | "relationship-suggestion"
  | "remediation-suggestion"
  | "follow-up-check-suggestion";

export interface AdvisoryContextItem {
  id: string;
  kind: string;
  summary: string;
  classification: ContentClassification;
}

export interface AdvisoryRequest {
  purpose: AdvisoryPurpose;
  findingRefs?: readonly SecurityFindingId[];
  context: readonly AdvisoryContextItem[];
}

export interface AdvisoryResult {
  id: AdvisoryRecordId;
  kind: AdvisoryResultKind;
  summary: string;
  provenance: {
    kind: "inferred";
    rationale?: string;
  };
  relationshipSuggestions?: readonly RiskRelationship[];
}

export interface AdvisoryService {
  analyze(request: AdvisoryRequest): Promise<AdvisoryResult>;
}
