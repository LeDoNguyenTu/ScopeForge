import type { BaselineGate, Severity } from "../findings/types";
import type { InventoryBudgets } from "../inventory/types";

export type ScannerOutputFormat = "terminal" | "json" | "sarif";

export interface ScannerRuleSelection {
  include: string[];
  exclude: string[];
}

export interface ScannerSecretsConfig {
  allowFingerprints: string[];
}

export interface ScannerScaConfig {
  osv: {
    enabled: boolean;
  };
}

export interface ScannerOutputConfig {
  format: ScannerOutputFormat;
  path: string | undefined;
}

export interface ScannerConfig {
  version: 1;
  sourcePath: string | null;
  scanners: string[] | null;
  rules: ScannerRuleSelection;
  secrets: ScannerSecretsConfig;
  sca: ScannerScaConfig;
  budgets: InventoryBudgets;
  baseline: string | undefined;
  baselineGate: BaselineGate;
  failOn: Severity | undefined;
  output: ScannerOutputConfig;
}

export type ScannerConfigErrorCode = "invalid_config" | "unsafe_budget";

export class ScannerConfigError extends Error {
  readonly code: ScannerConfigErrorCode;

  constructor(code: ScannerConfigErrorCode, message: string) {
    super(message);
    this.name = "ScannerConfigError";
    this.code = code;
  }
}
