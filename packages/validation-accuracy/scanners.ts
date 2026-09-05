import type { Scanner } from "../scanner-core/coordinator/types";
import { IAC_RULES, createIacScanner } from "../scanner-iac";
import { JSTS_RULES, createJstsScanner } from "../scanner-jsts";
import { SECRET_RULES, createSecretScanner } from "../scanner-secrets";
import type { ValidationScannerFamily } from "./contracts";
import { ValidationAccuracyError } from "./error";

const OFFLINE_V1_RULES: Readonly<Record<ValidationScannerFamily, ReadonlySet<string>>> = Object.freeze({
  secrets: new Set(["secrets/github-token"]),
  jsts: new Set([
    "jsts/dynamic-code-execution",
    "jsts/command-injection",
  ]),
  iac: new Set([
    "iac/docker-floating-base-image",
    "iac/kubernetes-privileged-container",
    "iac/terraform-aws-public-rds",
    "iac/github-actions-write-all-permissions",
    "iac/config-npm-strict-ssl-disabled",
  ]),
});

function registeredRuleIds(scanner: ValidationScannerFamily): ReadonlySet<string> {
  switch (scanner) {
    case "secrets":
      return new Set(SECRET_RULES.map((rule) => rule.id));
    case "jsts":
      return new Set(JSTS_RULES.map((rule) => rule.id));
    case "iac":
      return new Set(IAC_RULES.map((rule) => rule.id));
  }
}

function assertOwnedOfflineRule(scanner: ValidationScannerFamily, ruleId: string): void {
  if (!OFFLINE_V1_RULES[scanner].has(ruleId) || !registeredRuleIds(scanner).has(ruleId)) {
    throw new ValidationAccuracyError(
      "VALIDATION_RULE_INVALID",
      "Validation rule is not an approved offline-v1 rule for the selected scanner family.",
      "ruleId",
    );
  }
}

export function createValidationScanner(
  scanner: ValidationScannerFamily,
  ruleId: string,
): Scanner {
  assertOwnedOfflineRule(scanner, ruleId);
  const rules = { include: [ruleId], exclude: [] };

  switch (scanner) {
    case "secrets":
      return createSecretScanner({ allowFingerprints: [], rules });
    case "jsts":
      return createJstsScanner({ rules });
    case "iac":
      return createIacScanner({ rules });
  }
}
