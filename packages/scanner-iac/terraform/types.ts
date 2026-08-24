import type { ScannerRuleSelection } from "../../scanner-core/config/types";
import type { ScannerDiagnostic } from "../../scanner-core/coordinator/types";
import type { Finding } from "../../scanner-core/findings/types";

export type TerraformBlockKind = "resource" | "data";
export type TerraformRecord = Record<string, unknown>;

export interface ParsedTerraformBlock {
  kind: TerraformBlockKind;
  type: string;
  name: string;
  value: TerraformRecord;
  startLine: number;
}

export interface ParseTerraformHclInput {
  file: string;
  content: string;
}

export interface TerraformParserOptions {
  maxBlocks?: number;
}

export interface TerraformParseResult {
  blocks: ParsedTerraformBlock[];
  errors: ScannerDiagnostic[];
}

export interface ScanTerraformHclInput extends ParseTerraformHclInput {
  rules?: ScannerRuleSelection;
  parser?: TerraformParserOptions;
}

export interface TerraformScanResult {
  findings: Finding[];
  errors: ScannerDiagnostic[];
}
