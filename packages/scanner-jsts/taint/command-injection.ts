import type { ScannerDiagnostic } from "../../scanner-core/coordinator/types";
import type { ScannerRuleSelection } from "../../scanner-core/config/types";
import { compareFindings } from "../../scanner-core/findings/severity";
import type { Finding } from "../../scanner-core/findings/types";
import { createJstsTaintFinding } from "../findings/create-taint-finding";
import { JSTS_RULES } from "../rules/builtin";
import { analyzeExpressHandler } from "./analyze-handler";
import { collectTaintBindings } from "./bindings";
import type { TaintBudget } from "./types";

export interface ScanCommandInjectionInput {
  sourceFile: import("typescript").SourceFile;
  rules?: ScannerRuleSelection;
  maxSteps: number;
}

export interface ScanCommandInjectionResult {
  findings: Finding[];
  error?: ScannerDiagnostic;
}

const RULE_ID = "jsts/command-injection";

function ruleEnabled(selection: ScannerRuleSelection | undefined): boolean {
  if (!selection) return true;
  if (selection.exclude.includes(RULE_ID)) return false;
  return selection.include.length === 0 || selection.include.includes(RULE_ID);
}

function hasSupportedRuntimeModules(sourceFile: import("typescript").SourceFile): boolean {
  const text = sourceFile.text;
  return text.includes("express") && text.includes("child_process");
}

function budgetError(file: string): ScanCommandInjectionResult {
  return {
    findings: [],
    error: {
      code: "taint_budget_exceeded",
      file,
      message: "Source file exceeded the JavaScript/TypeScript taint-analysis step budget."
    }
  };
}

export function scanCommandInjection(input: ScanCommandInjectionInput): ScanCommandInjectionResult {
  if (!ruleEnabled(input.rules)) return { findings: [] };

  const rule = JSTS_RULES.find((candidate) => candidate.id === RULE_ID);
  if (!rule) {
    return {
      findings: [],
      error: {
        code: "taint_rule_unavailable",
        file: input.sourceFile.fileName,
        message: "The built-in command-injection rule is unavailable."
      }
    };
  }

  if (!hasSupportedRuntimeModules(input.sourceFile)) return { findings: [] };

  const budget: TaintBudget = { maxSteps: input.maxSteps, steps: 0 };
  const bindings = collectTaintBindings(input.sourceFile, budget);
  if (bindings.exceeded || budget.exceeded) return budgetError(input.sourceFile.fileName);

  const findings: Finding[] = [];
  const occurrences = new Map<string, number>();

  for (const handler of bindings.routeHandlers) {
    const analyzed = analyzeExpressHandler({
      handler: handler.callback,
      requestName: handler.requestName,
      commandSinks: bindings.commandSinks,
      sourceFile: input.sourceFile,
      budget
    });
    if (analyzed.exceeded || budget.exceeded) return budgetError(input.sourceFile.fileName);

    const structuralContext = `express-route:${handler.routeMethod}`;
    for (const flow of analyzed.sinkFlows) {
      const occurrenceKey = `${structuralContext}\n${flow.source.kind}\n${flow.sink}`;
      const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
      occurrences.set(occurrenceKey, occurrence);
      findings.push(
        createJstsTaintFinding({
          rule,
          file: input.sourceFile.fileName,
          sourceFile: input.sourceFile,
          flow,
          structuralContext,
          occurrence
        })
      );
    }
  }

  return { findings: findings.sort(compareFindings) };
}
