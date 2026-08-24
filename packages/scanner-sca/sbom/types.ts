import type { ScannerDiagnostic } from "../../scanner-core/coordinator/types";

export interface GenerateCycloneDxSbomOptions {
  toolVersion: string;
  timestamp?: Date;
  serialNumber?: string;
}

export interface CycloneDxSbomResult {
  sbom?: string;
  errors: ScannerDiagnostic[];
}
