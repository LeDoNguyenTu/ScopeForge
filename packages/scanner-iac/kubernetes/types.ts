import type { ScannerDiagnostic } from "../../scanner-core/coordinator/types";
import type { ScannerRuleSelection } from "../../scanner-core/config/types";
import type { Finding } from "../../scanner-core/findings/types";

export type KubernetesPathSegment = string | number;

export interface KubernetesLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface ParsedKubernetesDocument {
  index: number;
  apiVersion: string | null;
  kind: string | null;
  value: unknown;
  location(path: readonly KubernetesPathSegment[]): KubernetesLocation | null;
}

export interface ParseKubernetesYamlInput {
  file: string;
  content: string;
}

export interface KubernetesParserOptions {
  maxDocuments?: number;
  maxAliasCount?: number;
}

export interface KubernetesParseResult {
  documents: ParsedKubernetesDocument[];
  errors: ScannerDiagnostic[];
}

export interface ScanKubernetesYamlInput extends ParseKubernetesYamlInput {
  rules?: ScannerRuleSelection;
  parser?: KubernetesParserOptions;
}

export interface KubernetesScanResult {
  findings: Finding[];
  errors: ScannerDiagnostic[];
}
