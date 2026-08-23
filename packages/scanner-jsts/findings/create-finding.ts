import ts from "typescript";

import { createFindingFingerprint } from "../../scanner-core/findings/fingerprint";
import type { Finding } from "../../scanner-core/findings/types";
import type { JstsRuleDefinition } from "../rules/types";

export interface CreateJstsFindingInput {
  rule: JstsRuleDefinition;
  file: string;
  sourceFile: ts.SourceFile;
  node: ts.Node;
  structuralContext: string;
  sink: string;
  evidence: string;
  occurrence: number;
}

export function createJstsFinding(input: CreateJstsFindingInput): Finding {
  const start = input.sourceFile.getLineAndCharacterOfPosition(input.node.getStart(input.sourceFile));
  const end = input.sourceFile.getLineAndCharacterOfPosition(input.node.getEnd());
  const fingerprint = createFindingFingerprint({
    scanner: "jsts",
    ruleId: input.rule.id,
    file: input.file,
    structuralContext: input.structuralContext,
    source: `occurrence:${input.occurrence}`,
    sink: input.sink
  });

  return {
    id: fingerprint,
    fingerprint,
    scanner: "jsts",
    ruleId: input.rule.id,
    ruleVersion: input.rule.version,
    title: input.rule.title,
    description: input.rule.description,
    severity: input.rule.severity,
    confidence: input.rule.confidence,
    category: "sast",
    validation: "static_confirmed",
    provenance: "observed",
    location: {
      file: input.file,
      startLine: start.line + 1,
      startColumn: start.character + 1,
      endLine: end.line + 1,
      endColumn: end.character + 1
    },
    evidence: {
      summary: `Observed ${input.sink} in ${input.structuralContext}.`,
      redactedSnippet: input.evidence
    },
    cwe: [...input.rule.cwe],
    owasp: [...input.rule.owasp],
    references: [],
    remediation: { ...input.rule.remediation },
    metadata: {
      structuralContext: input.structuralContext,
      sink: input.sink
    },
    baselineState: "new"
  };
}
