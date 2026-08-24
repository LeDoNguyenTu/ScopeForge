import type { ScannerRuleSelection } from "../scanner-core/config/types";
import type { Scanner, ScannerRunResult } from "../scanner-core/coordinator/types";
import { compareFindings } from "../scanner-core/findings/severity";
import type { Finding } from "../scanner-core/findings/types";
import { createVulnerabilityFinding } from "./findings/create-vulnerability-finding";
import { collectNpmDependencies } from "./inventory";
import { queryOsvDependencies } from "./osv/client";
import type { OsvFetch } from "./osv/types";

const RULE_ID = "sca/known-vulnerability";

export interface CreateScaScannerOptions {
  rules?: ScannerRuleSelection;
  osv?: {
    enabled?: boolean;
    fetchImpl?: OsvFetch;
  };
}

function ruleEnabled(selection: ScannerRuleSelection | undefined): boolean {
  if (!selection) return true;
  if (selection.exclude.includes(RULE_ID)) return false;
  return selection.include.length === 0 || selection.include.includes(RULE_ID);
}

function dedupeFindings(findings: readonly Finding[]): Finding[] {
  const byFingerprint = new Map<string, Finding>();
  for (const finding of findings) {
    if (!byFingerprint.has(finding.fingerprint)) byFingerprint.set(finding.fingerprint, finding);
  }
  return [...byFingerprint.values()].sort(compareFindings);
}

export function createScaScanner(options: CreateScaScannerOptions = {}): Scanner {
  const osvEnabled = options.osv?.enabled ?? false;

  return {
    name: "sca",
    version: "1.0.0",
    async scan(context): Promise<ScannerRunResult> {
      const inventory = await collectNpmDependencies(context.inventory);
      if (!ruleEnabled(options.rules) || !osvEnabled || inventory.components.length === 0) {
        return { findings: [], errors: inventory.errors };
      }

      const lookup = await queryOsvDependencies(inventory.components, {
        ...(options.osv?.fetchImpl ? { fetchImpl: options.osv.fetchImpl } : {})
      });
      if (lookup.errors.length > 0) {
        return { findings: [], errors: [...inventory.errors, ...lookup.errors] };
      }

      const findings: Finding[] = [];
      for (const match of lookup.matches) {
        for (const vulnerability of match.vulnerabilities) {
          findings.push(createVulnerabilityFinding(match.component, vulnerability));
        }
      }

      return {
        findings: dedupeFindings(findings),
        errors: inventory.errors
      };
    }
  };
}
