import type { ScannerDiagnostic } from "../../scanner-core/coordinator/types";
import type { ScannerRuleSelection } from "../../scanner-core/config/types";
import type { Finding } from "../../scanner-core/findings/types";

export type SecurityConfigKind = "npmrc" | "vercel";

export interface ScanSecurityConfigInput {
  file: string;
  content: string;
  rules?: ScannerRuleSelection;
}

export interface SecurityConfigScanResult {
  findings: Finding[];
  errors: ScannerDiagnostic[];
}
