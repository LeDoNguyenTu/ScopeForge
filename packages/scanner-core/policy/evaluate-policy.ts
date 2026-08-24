import { isSeverityAtLeast } from "../findings/severity";
import type {
  BaselineGate,
  Finding,
  ScanError,
  ScanPolicyResult,
  Severity
} from "../findings/types";
import { SCAN_EXIT, type ScanExitCode } from "./exit-codes";

export interface EvaluatePolicyOptions {
  baselineGate?: BaselineGate;
}

export function evaluatePolicy(
  findings: Finding[],
  failOn?: Severity,
  options: EvaluatePolicyOptions = {}
): ScanPolicyResult {
  if (!failOn) {
    return { mode: "report-only", passed: true };
  }

  const baselineGate = options.baselineGate ?? "new";
  const failed = findings.some(
    (finding) =>
      (baselineGate === "all" || finding.baselineState !== "existing") &&
      isSeverityAtLeast(finding.severity, failOn)
  );

  return {
    mode: "enforce",
    passed: !failed,
    failOn,
    baselineGate
  };
}

export interface ResolveScanExitCodeInput {
  errors: ScanError[];
  policyPassed: boolean;
}

export function resolveScanExitCode(input: ResolveScanExitCodeInput): ScanExitCode {
  if (input.errors.length > 0) return SCAN_EXIT.SCANNER_ERROR;
  if (!input.policyPassed) return SCAN_EXIT.POLICY_FAILED;
  return SCAN_EXIT.SUCCESS;
}
