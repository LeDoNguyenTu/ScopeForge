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

function isHttpsAgentWithoutVerification(node: ts.Node): node is ts.NewExpression {
  if (!ts.isNewExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  if (node.expression.name.text !== "Agent") return false;
  if (!ts.isIdentifier(node.expression.expression) || node.expression.expression.text !== "https") return false;

  const options = node.arguments?.[0];
  return !!options && ts.isObjectLiteralExpression(options) && objectPropertyIsFalse(options, "rejectUnauthorized");
}

function isInsecureResponseCookie(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  if (node.expression.name.text !== "cookie") return false;
  if (!ts.isIdentifier(node.expression.expression)) return false;
  if (node.expression.expression.text !== "res" && node.expression.expression.text !== "response") return false;

  const options = node.arguments[2];
  return !!options && ts.isObjectLiteralExpression(options) && objectPropertyIsFalse(options, "secure");
}

export function scanSourceFile(input: ScanSourceFileInput): ScanSourceFileResult {
  const rules = enabledRules(input.rules);
  const findings: Finding[] = [];
  const occurrences = new Map<string, number>();

  function emit(node: ts.Node, ruleId: string, sink: string, evidence: string): void {
    const rule = rules.get(ruleId);
    if (!rule) return;

    const context = structuralContext(node);
    const occurrenceKey = `${ruleId}\n${context}\n${sink}`;
    const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
    occurrences.set(occurrenceKey, occurrence);
    findings.push(
      createJstsFinding({
        rule,
        file: input.file,
        sourceFile: input.sourceFile,
        node,
        structuralContext: context,
        sink,
        evidence,
        occurrence
      })
    );
  }

  const traversal = walkAst(
    input.sourceFile,
    (node) => {
      if (isDirectEval(node)) {
        emit(node, "jsts/dynamic-code-execution", "eval", "eval(...)");
      } else if (isFunctionConstructor(node)) {
        emit(node, "jsts/dynamic-code-execution", "Function", "new Function(...)");
      }

      if (isProcessTlsAssignment(node)) {
        emit(
          node,
          "jsts/tls-verification-disabled",
          "NODE_TLS_REJECT_UNAUTHORIZED",
          "NODE_TLS_REJECT_UNAUTHORIZED=0"
        );
      } else if (isHttpsAgentWithoutVerification(node)) {
        emit(
          node,
          "jsts/tls-verification-disabled",
          "https.Agent.rejectUnauthorized",
          "https.Agent({ rejectUnauthorized: false })"
        );
      }

      if (isInsecureResponseCookie(node)) {
        emit(
          node,
          "jsts/insecure-cookie",
          "response.cookie.secure",
          "response.cookie(..., { secure: false })"
        );
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

  return { findings: findings.sort(compareFindings) };
}
