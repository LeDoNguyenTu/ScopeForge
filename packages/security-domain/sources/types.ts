import type { ScanRunRef } from "../common/identifiers";

export type FindingSourceKind =
  | "deterministic-passive-scanner"
  | "deterministic-runtime-scanner"
  | "external-scanner"
  | "user-confirmed"
  | "advisory-inference";

export interface FindingSourceRef {
  kind: FindingSourceKind;
  sourceId: string;
  sourceVersion?: string;
  scanRunRef?: ScanRunRef;
}
