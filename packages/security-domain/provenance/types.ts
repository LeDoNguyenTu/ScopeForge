export type ProvenanceKind = "observed" | "scanner-derived" | "user-confirmed" | "inferred";

export interface ProvenanceRecord {
  kind: ProvenanceKind;
  rationale?: string;
}
