import type { ScannerRuleSelection } from "../../scanner-core/config/types";
import type { ScannerDiagnostic } from "../../scanner-core/coordinator/types";
import type { Finding } from "../../scanner-core/findings/types";

export type GitHubActionsPathSegment = string | number;

export interface GitHubActionsLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface ParsedGitHubActionsWorkflow {
  value: unknown;
  location(path: readonly GitHubActionsPathSegment[]): GitHubActionsLocation | null;
}

export interface ParseGitHubActionsYamlInput {
  file: string;
  content: string;
}

export interface GitHubActionsParserOptions {
  maxAliasCount?: number;
}

export interface GitHubActionsParseResult {
  workflow: ParsedGitHubActionsWorkflow | null;
  errors: ScannerDiagnostic[];
}

export interface ScanGitHubActionsYamlInput extends ParseGitHubActionsYamlInput {
  rules?: ScannerRuleSelection;
  parser?: GitHubActionsParserOptions;
}

export interface GitHubActionsScanResult {
  findings: Finding[];
  errors: ScannerDiagnostic[];
}
