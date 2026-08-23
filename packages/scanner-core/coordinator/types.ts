import type { Finding } from "../findings/types";
import type { RepositoryInventory } from "../inventory/types";

export interface ScannerContext {
  root: string;
  inventory: RepositoryInventory;
}

export interface ScannerDiagnostic {
  code: string;
  file?: string;
  message: string;
}

export interface ScannerRunResult {
  findings: Finding[];
  errors: ScannerDiagnostic[];
}

export interface Scanner {
  name: string;
  version: string;
  scan(context: ScannerContext): Promise<Finding[] | ScannerRunResult>;
}

export interface RunScanInput {
  root: string;
  inventory: RepositoryInventory;
  scanners: Scanner[];
}
