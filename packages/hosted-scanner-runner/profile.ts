import type { Scanner } from "../scanner-core/coordinator/types";
import { createIacScanner } from "../scanner-iac";
import { createJstsScanner } from "../scanner-jsts";
import { createScaScanner } from "../scanner-sca";
import { createSecretScanner } from "../scanner-secrets";
export {
  HOSTED_PHASE3_SCANNER_DESCRIPTORS,
  HOSTED_PHASE3_SCANNER_PROFILE_ID,
  HOSTED_PHASE3_SCANNER_PROFILE_VERSION,
  HOSTED_PHASE3_TOOL_VERSION,
} from "./contract";

export function createHostedPhase3Scanners(): Scanner[] {
  return [
    createSecretScanner(),
    createJstsScanner(),
    createScaScanner({ osv: { enabled: false } }),
    createIacScanner(),
  ];
}
