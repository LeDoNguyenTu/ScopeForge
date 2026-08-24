import type ts from "typescript";

import { createFindingFingerprint } from "../../scanner-core/findings/fingerprint";
import type { Finding } from "../../scanner-core/findings/types";
import type { JstsRuleDefinition } from "../rules/types";
import type { CommandTaintFlow } from "../taint/types";

export interface CreateJstsTaintFindingInput {
  rule: JstsRuleDefinition;
  file: string;
  sourceFile: ts.SourceFile;
  flow: CommandTaintFlow;
  structuralContext: string;
  occurrence: number;
}

export function createJstsTaintFinding(input: CreateJstsTaintFindingInput): Finding {
  const start = input.sourceFile.getLineAndCharacterOfPosition(input.flow.sinkNode.getStart(input.sourceFile));
  const end = input.sourceFile.getLineAndCharacterOfPosition(input.flow.sinkNode.getEnd());
  const fingerprint = createFindingFingerprint({
    scanner: "jsts",
    ruleId: input.rule.id,
    file: input.file,
    structuralContext: input.structuralContext,
    source: `${input.flow.source.kind}:occurrence:${input.occurrence}`,
    sink: input.flow.sink
  });
  const sinkLabel = input.flow.sink === "child_process.exec" ? "child_process.exec(...)" : "child_process.execSync(...)";

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
      summary: `Observed a modeled Express request input flow to ${sinkLabel} in ${input.structuralContext}.`,
      redactedSnippet: `request input -> ${sinkLabel}`,
      dataFlow: input.flow.trace.map((step) => ({
        file: input.file,
        line: step.line,
        label: step.label
      }))
    },
    cwe: [...input.rule.cwe],
    owasp: [...input.rule.owasp],
    references: [],
    remediation: { ...input.rule.remediation },
    metadata: {
      structuralContext: input.structuralContext,
      sourceClass: input.flow.source.kind,
      sink: input.flow.sink
    },
    baselineState: "new"
  };
}
