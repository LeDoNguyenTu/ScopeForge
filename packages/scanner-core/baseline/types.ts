import type { Finding, Severity } from "../findings/types";

export interface BaselineEntry {
  fingerprint: string;
  scanner: string;
  ruleId: string;
  ruleVersion: string;
  severity: Severity;
  file: string;
}

export interface BaselineFile {
  version: 1;
  tool: {
    name: "ScopeForge";
    version: string;
  };
  entries: BaselineEntry[];
}

export interface ApplyBaselineResult {
  findings: Finding[];
  resolved: BaselineEntry[];
}

export type BaselineErrorCode =
  | "invalid_baseline"
  | "baseline_too_large"
  | "unsafe_baseline"
  | "baseline_not_readable";

export class BaselineError extends Error {
  readonly code: BaselineErrorCode;

  constructor(code: BaselineErrorCode, message: string) {
    super(message);
    this.name = "BaselineError";
    this.code = code;
  }
}
