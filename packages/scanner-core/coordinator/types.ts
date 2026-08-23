import type { Finding } from "../findings/types";
import type { RepositoryInventory } from "../inventory/types";

export interface ScannerContext {
  root: string;
  inventory: RepositoryInventory;
}

export interface Scanner {
  name: string;
  version: string;
  scan(context: ScannerContext): Promise<Finding[]>;
}

export interface RunScanInput {
  root: string;
  inventory: RepositoryInventory;
  scanners: Scanner[];
}
