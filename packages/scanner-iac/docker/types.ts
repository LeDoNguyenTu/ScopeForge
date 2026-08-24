import type { ScannerDiagnostic } from "../../scanner-core/coordinator/types";
import type { ScannerRuleSelection } from "../../scanner-core/config/types";
import type { Finding } from "../../scanner-core/findings/types";

export interface DockerInstruction {
  keyword: string;
  value: string;
  startLine: number;
  endLine: number;
}

export interface ParseDockerfileInput {
  file: string;
  content: string;
}

export interface DockerParserOptions {
  maxInstructions?: number;
  maxInstructionBytes?: number;
}

export interface DockerParseResult {
  instructions: DockerInstruction[];
  errors: ScannerDiagnostic[];
}

export interface ScanDockerfileInput extends ParseDockerfileInput {
  rules?: ScannerRuleSelection;
  parser?: DockerParserOptions;
}

export interface DockerScanResult {
  findings: Finding[];
  errors: ScannerDiagnostic[];
}
