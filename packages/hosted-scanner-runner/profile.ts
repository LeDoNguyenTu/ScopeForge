import type { Scanner } from "../scanner-core/coordinator/types";
import { createIacScanner } from "../scanner-iac";
import { createJstsScanner } from "../scanner-jsts";
import { createScaScanner } from "../scanner-sca";
import { createSecretScanner } from "../scanner-secrets";

export const HOSTED_PHASE3_SCANNER_DESCRIPTORS = Object.freeze([
  "iac@1.0.0",
  "jsts@1.0.0",
  "sca@1.0.0",
  "secrets@1.0.0",
] as const);

export const HOSTED_PHASE3_SCANNER_PROFILE_ID = "phase3-hosted-static-v1" as const;
export const HOSTED_PHASE3_SCANNER_PROFILE_VERSION = 1 as const;
export const HOSTED_PHASE3_TOOL_VERSION = "0.1.0" as const;

export function createHostedPhase3Scanners(): Scanner[] {
  return [
    createSecretScanner(),
    createJstsScanner(),
    createScaScanner({ osv: { enabled: false } }),
    createIacScanner(),
  ];
}