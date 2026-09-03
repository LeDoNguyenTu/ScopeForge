import { createFindingFingerprint } from "@/packages/scanner-core/findings/fingerprint";
import type { Finding } from "@/packages/scanner-core/findings/types";

import type { SecurityPackManifestV1, SecurityPackRuleV1 } from "./contracts";
import type { SecurityPackLiteralMatch } from "./literal-matcher";

export interface CreateSecurityPackFindingInput {
  readonly pack: SecurityPackManifestV1;
  readonly rule: SecurityPackRuleV1;
  readonly file: string;
  readonly match: SecurityPackLiteralMatch;
}

export function createSecurityPackFinding({
  pack,
  rule,
  file,
  match,
}: CreateSecurityPackFindingInput): Finding {
  const publishedRuleId = `pack/${pack.packId}/${rule.id}`;
  const fingerprint = createFindingFingerprint({
    scanner: "security-pack",
    ruleId: publishedRuleId,
    file,
    structuralContext: `pack:${pack.version}:rule:${rule.version}:static_literal_v1`,
    source: `byte:${match.byteOffset}`,
    sink: `literal:${match.literalOrdinal}`,
  });

  return {
    id: fingerprint,
    fingerprint,
    scanner: "security-pack",
    ruleId: publishedRuleId,
    ruleVersion: rule.version,
    title: rule.title,
    description: rule.description,
    severity: rule.severity,
    confidence: rule.confidence,
    category: rule.category,
    validation: "static_confirmed",
    provenance: "observed",
    location: {
      file,
      startLine: match.startLine,
      startColumn: match.startColumn,
      endLine: match.endLine,
      endColumn: match.endColumn,
    },
    evidence: {
      summary: `Matched static pack rule ${publishedRuleId} at literal ordinal ${match.literalOrdinal}.`,
    },
    cwe: [...rule.mappings.cwe],
    owasp: [...rule.mappings.owasp],
    references: [],
    remediation: {
      summary: rule.remediation.summary,
      guidance: rule.remediation.guidance,
      verification: rule.remediation.verification,
    },
    metadata: {
      packId: pack.packId,
      packVersion: pack.version,
      matcher: "static_literal_v1",
    },
    baselineState: "new",
  };
}
