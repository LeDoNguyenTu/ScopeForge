import type { AdvisoryRecordId, SecurityFindingId } from "../common/identifiers";
import type { ContentClassification } from "../evidence/types";
import type { InferredProvenanceRecord } from "../provenance/types";
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

declare const preparedAdvisoryContextBrand: unique symbol;

export type PreparedAdvisoryContext = readonly AdvisoryContextItem[] & {
  readonly [preparedAdvisoryContextBrand]: true;
};

export interface AdvisoryRequest {
  purpose: AdvisoryPurpose;
  findingRefs?: readonly SecurityFindingId[];
  context: PreparedAdvisoryContext;
}

export type AdvisoryRelationshipSuggestion = Omit<RiskRelationship, "provenance"> & {
  provenance: InferredProvenanceRecord;
};

export interface AdvisoryResult {
  id: AdvisoryRecordId;
  kind: AdvisoryResultKind;
  summary: string;
  provenance: InferredProvenanceRecord;
  relationshipSuggestions?: readonly AdvisoryRelationshipSuggestion[];
}

export interface AdvisoryService {
  analyze(request: AdvisoryRequest): Promise<AdvisoryResult>;
}
