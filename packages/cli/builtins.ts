import { ScannerConfigError, type ScannerConfig, type ScannerRuleSelection } from "../scanner-core/config/types";
import type { Scanner } from "../scanner-core/coordinator/types";
import { IAC_RULES, IAC_RULE_IDS, createIacScanner } from "../scanner-iac";
import { JSTS_RULES, JSTS_RULE_IDS, createJstsScanner } from "../scanner-jsts";
import { SCA_RULES, SCA_RULE_IDS, createScaScanner } from "../scanner-sca";
import { SECRET_RULES, SECRET_RULE_IDS, createSecretScanner } from "../scanner-secrets";

export interface BuiltInRuleSummary {
  id: string;
  version: string;
  title: string;
}

export const BUILTIN_RULES: readonly BuiltInRuleSummary[] = [
  ...SECRET_RULES,
  ...JSTS_RULES,
  ...SCA_RULES,
  ...IAC_RULES
]
  .map((rule) => ({ id: rule.id, version: rule.version, title: rule.title }))
  .sort((left, right) => left.id.localeCompare(right.id));

const builtInRuleIds = new Set([
  ...SECRET_RULE_IDS,
  ...JSTS_RULE_IDS,
  ...SCA_RULE_IDS,
  ...IAC_RULE_IDS
]);

export function validateBuiltInRules(selection: ScannerRuleSelection): void {
  const unknown = [...selection.include, ...selection.exclude]
    .filter((ruleId) => !builtInRuleIds.has(ruleId))
    .sort();
  if (unknown.length > 0) {
    throw new ScannerConfigError(
      "invalid_config",
      `Unknown configured rule: ${[...new Set(unknown)].join(", ")}.`
    );
  }
}

export function formatBuiltInRuleList(): string {
  return `${BUILTIN_RULES.map((rule) => `${rule.id}\t${rule.version}\t${rule.title}`).join("\n")}\n`;
}

export function createBuiltInScanners(config: ScannerConfig): Scanner[] {
  return [
    createSecretScanner({
      allowFingerprints: config.secrets.allowFingerprints,
      rules: config.rules
    }),
    createJstsScanner({ rules: config.rules }),
    createScaScanner({
      rules: config.rules,
      osv: { enabled: config.sca.osv.enabled }
    }),
    createIacScanner({ rules: config.rules })
  ];
}
