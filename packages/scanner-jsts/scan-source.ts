import ts from "typescript";

import type { ScannerDiagnostic } from "../scanner-core/coordinator/types";
import type { ScannerRuleSelection } from "../scanner-core/config/types";
import { compareFindings } from "../scanner-core/findings/severity";
import type { Finding } from "../scanner-core/findings/types";
import { structuralContext } from "./ast/context";
import { walkAst } from "./ast/traverse";
import { createJstsFinding } from "./findings/create-finding";
import { JSTS_RULES } from "./rules/builtin";
import type { JstsRuleDefinition } from "./rules/types";

export interface ScanSourceFileInput {
  file: string;
  sourceFile: ts.SourceFile;
  rules?: ScannerRuleSelection;
  maxNodes: number;
}

export interface ScanSourceFileResult {
  findings: Finding[];
  error?: ScannerDiagnostic;
}

interface RuleCandidate {
  node: ts.Node;
  ruleId: string;
  sink: string;
  evidence: string;
  requiredGlobal?: "eval" | "Function" | "process";
  httpsBinding?: string;
}

const HTTPS_MODULE_SPECIFIERS = new Set(["https", "node:https"]);

function enabledRules(selection: ScannerRuleSelection | undefined): Map<string, JstsRuleDefinition> {
  const include = new Set(selection?.include ?? []);
  const exclude = new Set(selection?.exclude ?? []);
  return new Map(
    JSTS_RULES
      .filter((rule) => (include.size === 0 || include.has(rule.id)) && !exclude.has(rule.id))
      .map((rule) => [rule.id, rule])
  );
}

function propertyNameText(name: ts.PropertyName | undefined): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function objectPropertyIsFalse(object: ts.ObjectLiteralExpression, name: string): boolean {
  return object.properties.some(
    (property) =>
      ts.isPropertyAssignment(property) &&
      propertyNameText(property.name) === name &&
      property.initializer.kind === ts.SyntaxKind.FalseKeyword
  );
}

function moduleSpecifierText(node: ts.Expression): string | null {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
}

function requireModuleSpecifier(node: ts.Expression | undefined): string | null {
  if (!node || !ts.isCallExpression(node)) return null;
  if (!ts.isIdentifier(node.expression) || node.expression.text !== "require") return null;
  if (node.arguments.length !== 1) return null;
  return moduleSpecifierText(node.arguments[0] as ts.Expression);
}

function incrementBinding(counts: Map<string, number>, name: string): void {
  counts.set(name, (counts.get(name) ?? 0) + 1);
}

function recordBindingName(counts: Map<string, number>, name: ts.BindingName): void {
  if (ts.isIdentifier(name)) {
    incrementBinding(counts, name.text);
    return;
  }

  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    recordBindingName(counts, element.name);
  }
}

function recordDeclaredBindings(node: ts.Node, counts: Map<string, number>): void {
  if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
    recordBindingName(counts, node.name);
    return;
  }

  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node)) &&
    node.name
  ) {
    incrementBinding(counts, node.name.text);
    return;
  }

  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (clause?.name) incrementBinding(counts, clause.name.text);
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      incrementBinding(counts, clause.namedBindings.name.text);
    } else if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) incrementBinding(counts, element.name.text);
    }
    return;
  }

  if (ts.isImportEqualsDeclaration(node) || ts.isEnumDeclaration(node)) {
    incrementBinding(counts, node.name.text);
    return;
  }

  if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) {
    incrementBinding(counts, node.name.text);
  }
}

function recordHttpsModuleBinding(node: ts.Node, bindings: Set<string>): void {
  if (ts.isImportDeclaration(node)) {
    const specifier = moduleSpecifierText(node.moduleSpecifier);
    if (!specifier || !HTTPS_MODULE_SPECIFIERS.has(specifier)) return;

    const clause = node.importClause;
    if (clause?.name) bindings.add(clause.name.text);
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      bindings.add(clause.namedBindings.name.text);
    }
    return;
  }

  if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) return;
  const declarationList = node.parent;
  if (!ts.isVariableDeclarationList(declarationList)) return;
  if ((declarationList.flags & ts.NodeFlags.Const) === 0) return;
  const statement = declarationList.parent;
  if (!ts.isVariableStatement(statement) || !ts.isSourceFile(statement.parent)) return;

  const specifier = requireModuleSpecifier(node.initializer);
  if (specifier && HTTPS_MODULE_SPECIFIERS.has(specifier)) bindings.add(node.name.text);
}

function isDirectEval(node: ts.Node): node is ts.CallExpression {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "eval";
}

function isFunctionConstructor(node: ts.Node): node is ts.NewExpression {
  return ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Function";
}

function isProcessTlsAssignment(node: ts.Node): node is ts.BinaryExpression {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return false;
  if (!ts.isPropertyAccessExpression(node.left) || node.left.name.text !== "NODE_TLS_REJECT_UNAUTHORIZED") return false;

  const env = node.left.expression;
  if (!ts.isPropertyAccessExpression(env) || env.name.text !== "env") return false;
  if (!ts.isIdentifier(env.expression) || env.expression.text !== "process") return false;

  return (
    (ts.isStringLiteral(node.right) && node.right.text === "0") ||
    (ts.isNumericLiteral(node.right) && Number(node.right.text) === 0) ||
    (ts.isNoSubstitutionTemplateLiteral(node.right) && node.right.text === "0")
  );
}

function httpsAgentReceiverWithoutVerification(node: ts.Node): string | null {
  if (!ts.isNewExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
  if (node.expression.name.text !== "Agent") return null;
  const receiver = node.expression.expression;
  if (!ts.isIdentifier(receiver)) return null;

  const options = node.arguments?.[0];
  if (!options || !ts.isObjectLiteralExpression(options)) return null;
  if (!objectPropertyIsFalse(options, "rejectUnauthorized")) return null;
  return receiver.text;
}

export function scanSourceFile(input: ScanSourceFileInput): ScanSourceFileResult {
  const rules = enabledRules(input.rules);
  const findings: Finding[] = [];
  const occurrences = new Map<string, number>();
  const declaredBindings = new Map<string, number>();
  const httpsModuleBindings = new Set<string>();
  const candidates: RuleCandidate[] = [];

  function emit(candidate: RuleCandidate): void {
    const rule = rules.get(candidate.ruleId);
    if (!rule) return;

    const context = structuralContext(candidate.node);
    const occurrenceKey = `${candidate.ruleId}\n${context}\n${candidate.sink}`;
    const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
    occurrences.set(occurrenceKey, occurrence);
    findings.push(
      createJstsFinding({
        rule,
        file: input.file,
        sourceFile: input.sourceFile,
        node: candidate.node,
        structuralContext: context,
        sink: candidate.sink,
        evidence: candidate.evidence,
        occurrence
      })
    );
  }

  const traversal = walkAst(
    input.sourceFile,
    (node) => {
      recordDeclaredBindings(node, declaredBindings);
      recordHttpsModuleBinding(node, httpsModuleBindings);

      if (isDirectEval(node)) {
        candidates.push({
          node,
          ruleId: "jsts/dynamic-code-execution",
          sink: "eval",
          evidence: "eval(...)",
          requiredGlobal: "eval"
        });
      } else if (isFunctionConstructor(node)) {
        candidates.push({
          node,
          ruleId: "jsts/dynamic-code-execution",
          sink: "Function",
          evidence: "new Function(...)",
          requiredGlobal: "Function"
        });
      }

      if (isProcessTlsAssignment(node)) {
        candidates.push({
          node,
          ruleId: "jsts/tls-verification-disabled",
          sink: "NODE_TLS_REJECT_UNAUTHORIZED",
          evidence: "NODE_TLS_REJECT_UNAUTHORIZED=0",
          requiredGlobal: "process"
        });
      } else {
        const receiver = httpsAgentReceiverWithoutVerification(node);
        if (receiver) {
          candidates.push({
            node,
            ruleId: "jsts/tls-verification-disabled",
            sink: "https.Agent.rejectUnauthorized",
            evidence: "https.Agent({ rejectUnauthorized: false })",
            httpsBinding: receiver
          });
        }
      }
    },
    { maxNodes: input.maxNodes }
  );

  if (traversal.exceeded) {
    return {
      findings: [],
      error: {
        code: "ast_budget_exceeded",
        file: input.file,
        message: "Source file exceeded the JavaScript/TypeScript AST node budget."
      }
    };
  }

  for (const candidate of candidates) {
    if (candidate.requiredGlobal && (declaredBindings.get(candidate.requiredGlobal) ?? 0) > 0) {
      continue;
    }
    if (
      candidate.httpsBinding &&
      (!httpsModuleBindings.has(candidate.httpsBinding) ||
        (declaredBindings.get(candidate.httpsBinding) ?? 0) !== 1)
    ) {
      continue;
    }
    emit(candidate);
  }

  return { findings: findings.sort(compareFindings) };
}
