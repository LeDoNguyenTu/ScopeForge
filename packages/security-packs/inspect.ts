import { compareText } from "../scanner-core/determinism/compare-text";
import type { LoadedSecurityPack, SecurityPackRuleV1 } from "./contracts";

function sorted(values: readonly string[]): string[] {
  return [...values].sort(compareText);
}

function compareRules(left: SecurityPackRuleV1, right: SecurityPackRuleV1): number {
  return compareText(left.id, right.id) || compareText(left.version, right.version);
}

export function inspectSecurityPack(pack: LoadedSecurityPack): string {
  const envelope = {
    schemaVersion: 1,
    pack: {
      id: pack.manifest.packId,
      version: pack.manifest.version,
      name: pack.manifest.name,
      summary: pack.manifest.summary,
      license: pack.manifest.license,
      repository: pack.manifest.repository,
      maintainers: sorted(pack.manifest.maintainers),
      safety: pack.manifest.safety,
      minimumScopeForgeVersion: pack.manifest.minimumScopeForgeVersion,
    },
    rules: [...pack.manifest.rules].sort(compareRules).map((rule) => ({
      id: rule.id,
      publishedRuleId: `pack/${pack.manifest.packId}/${rule.id}`,
      version: rule.version,
      title: rule.title,
      severity: rule.severity,
      confidence: rule.confidence,
      mappings: {
        cwe: sorted(rule.mappings.cwe),
        owasp: sorted(rule.mappings.owasp),
        attack: sorted(rule.mappings.attack),
        nistCsf: sorted(rule.mappings.nistCsf),
      },
      matcher: {
        kind: rule.kind,
        requiredLiteralCount: rule.matcher.literals.length,
        absentLiteralCount: rule.matcher.absentLiterals.length,
      },
    })),
  };

  return `${JSON.stringify(envelope, null, 2)}\n`;
}
