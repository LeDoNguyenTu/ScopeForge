export type ProvenanceKind = "observed" | "scanner-derived" | "user-confirmed" | "inferred";

export interface ProvenanceRecord<Kind extends ProvenanceKind = ProvenanceKind> {
  kind: Kind;
  rationale?: string;
}

export type InferredProvenanceRecord = ProvenanceRecord<"inferred">;
