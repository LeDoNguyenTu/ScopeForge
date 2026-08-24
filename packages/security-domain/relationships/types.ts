import type {
  AssetRef,
  EvidenceId,
  RelationshipId,
  SecurityFindingId,
} from "../common/identifiers";
import type { SecurityConfidence } from "../common/security-levels";
import type { ProvenanceRecord } from "../provenance/types";

export type RiskRelationshipType =
  | "exposes"
  | "reaches"
  | "depends_on"
  | "authenticates_to"
  | "can_lead_to"
  | "affects"
  | "mitigated_by";

export type SecurityEntityRef =
  | { kind: "finding"; ref: SecurityFindingId }
  | { kind: "asset"; ref: AssetRef }
  | { kind: "evidence"; ref: EvidenceId }
  | { kind: "identity"; ref: string }
  | { kind: "data-store"; ref: string }
  | { kind: "consequence"; ref: string }
  | { kind: "control"; ref: string };

export interface RiskRelationship {
  id: RelationshipId;
  type: RiskRelationshipType;
  from: SecurityEntityRef;
  to: SecurityEntityRef;
  provenance: ProvenanceRecord;
  confidence: SecurityConfidence;
}
