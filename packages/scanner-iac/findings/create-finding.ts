import { createFindingFingerprint } from "../../scanner-core/findings/fingerprint";
import type { Finding } from "../../scanner-core/findings/types";
import type { DockerInstruction } from "../docker/types";
import type { IacRuleDefinition } from "../rules/types";

export interface CreateIacFindingInput {
  rule: IacRuleDefinition;
  file: string;
  instruction: DockerInstruction;
  structuralContext: string;
  occurrence: number;
  evidenceSummary: string;
}

export function createIacFinding(input: CreateIacFindingInput): Finding {
  const fingerprint = createFindingFingerprint({
    scanner: "iac",
    ruleId: input.rule.id,
    file: input.file,
    structuralContext: input.structuralContext,
    source: `occurrence:${input.occurrence}`,
    sink: input.instruction.keyword
  });

  return {
    id: fingerprint,
    fingerprint,
    scanner: "iac",
    ruleId: input.rule.id,
    ruleVersion: input.rule.version,
    title: input.rule.title,
    description: input.rule.description,
    severity: input.rule.severity,
    confidence: input.rule.confidence,
    category: "iac",
    validation: "static_confirmed",
    provenance: "observed",
    location: {
      file: input.file,
      startLine: input.instruction.startLine,
      startColumn: 1,
      endLine: input.instruction.endLine,
      endColumn: 1
    },
    evidence: {
      summary: input.evidenceSummary
    },
    cwe: [...input.rule.cwe],
    owasp: [...input.rule.owasp],
    references: [],
    remediation: { ...input.rule.remediation },
    metadata: {
      instruction: input.instruction.keyword,
      structuralContext: input.structuralContext
    },
    baselineState: "new"
  };
}
