import type { Json } from "@/lib/database.types";
import type { EvidenceRecord, SecurityFinding } from "@/packages/security-domain";

export interface FindingIngestionBatch {
  workspaceId: string;
  assetId: string;
  scanJobId: string;
  observedAt: Date;
  findings: readonly SecurityFinding[];
  evidence: readonly EvidenceRecord[];
}

export interface PreparedFindingIngestion {
  workspaceId: string;
  assetId: string;
  scanJobId: string;
  observedAt: string;
  findings: Json;
  evidence: Json;
}
