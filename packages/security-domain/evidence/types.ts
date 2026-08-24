import type { EvidenceId } from "../common/identifiers";
import type { ProvenanceRecord } from "../provenance/types";

export type EvidenceKind =
  | "repository-location"
  | "static-analysis"
  | "dependency"
  | "http-observation"
  | "tls-observation"
  | "user-confirmed"
  | "artifact-reference";

export type ContentClassification = "public" | "internal" | "sensitive" | "secret";

export interface EvidenceRecord {
  id: EvidenceId;
  kind: EvidenceKind;
  provenance: ProvenanceRecord;
  summary: string;
  classification: ContentClassification;
  artifactRef?: string;
}
