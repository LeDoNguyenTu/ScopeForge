import ts from "typescript";

import {
  chargeTaintBudget,
  type TaintBudget,
  type TaintOrigin,
  type TaintOriginKind,
  type TaintTraceStep,
  type TaintValue
} from "./types";

export interface EvaluateTaintExpressionInput {
  expression: ts.Expression;
  requestName: string;
  environment: ReadonlyMap<string, TaintValue>;
  sourceFile: ts.SourceFile;
  budget: TaintBudget;
}

const SOURCE_LABELS: Record<TaintOriginKind, string> = {
  "express-query": "Source: Express query parameter",
  "express-params": "Source: Express route parameter",
  "express-body": "Source: Express request body field"
};

const STRING_METHODS = new Set(["trim", "toLowerCase", "toUpperCase", "replace"]);
const NUMERIC_SANITIZERS = new Set(["Number", "parseInt", "parseFloat"]);

function safeValue(): TaintValue {
  return { tainted: false, trace: [] };
}

function lineOf(node: ts.Node, sourceFile: ts.SourceFile): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function accessSegment(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): string | null {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  const argument = node.argumentExpression;
  if (!argument) return null;
  if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) return argument.text;
  return "*";
}

function requestSourceKind(expression: ts.Expression, requestName: string): TaintOriginKind | null {
  const segments: string[] = [];
  let cursor: ts.Expression = expression;

  while (ts.isPropertyAccessExpression(cursor) || ts.isElementAccessExpression(cursor)) {
    const segment = accessSegment(cursor);
    if (segment === null) return null;
    segments.unshift(segment);
    cursor = cursor.expression;
  }

  if (!ts.isIdentifier(cursor) || cursor.text !== requestName || segments.length < 2) return null;
  if (segments[0] === "query") return "express-query";
  if (segments[0] === "params") return "express-params";
  if (segments[0] === "body") return "express-body";
  return null;
}

function bindingNameContains(name: ts.BindingName, target: string): boolean {
  if (ts.isIdentifier(name)) return name.text === target;
  return name.elements.some(
    (element) => !ts.isOmittedExpression(element) && bindingNameContains(element.name, target)
  );
}

function declaresRuntimeName(node: ts.Node, target: string): boolean {
  if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
    return bindingNameContains(node.name, target);
  }

  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node)) &&
    node.name
  ) {
    return node.name.text === target;
  }

  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause || clause.isTypeOnly) return false;
    if (clause.name?.text === target) return true;
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      return clause.namedBindings.name.text === target;
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      return clause.namedBindings.elements.some((element) => !element.isTypeOnly && element.name.text === target);
    }
    return false;
  }

  if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly) {
    return node.name.text === target;
  }

  return ts.isEnumDeclaration(node) && node.name.text === target;
}

function unshadowedRuntimeGlobal(name: string, sourceFile: ts.SourceFile, budget: TaintBudget): boolean {
  const stack: ts.Node[] = [sourceFile];
  while (stack.length > 0) {
    if (!chargeTaintBudget(budget)) return false;
    const node = stack.pop() as ts.Node;
    if (declaresRuntimeName(node, name)) return false;

    const children: ts.Node[] = [];
    ts.forEachChild(node, (child) => {
      children.push(child);
    });
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index] as ts.Node);
    }
  }
  return true;
}

function appendTrace(
  value: TaintValue,
  step: TaintTraceStep,
  budget: TaintBudget
): TaintValue {
  if (!value.tainted || !value.origin || !chargeTaintBudget(budget)) return safeValue();
  return {
    tainted: true,
    origin: value.origin,
    trace: [...value.trace, step]
  };
}

function sourceValue(
  kind: TaintOriginKind,
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  budget: TaintBudget
): TaintValue {
  if (!chargeTaintBudget(budget)) return safeValue();
  const line = lineOf(expression, sourceFile);
  const origin: TaintOrigin = { kind, line };
  return {
    tainted: true,
    origin,
    trace: [{ kind: "source", line, label: SOURCE_LABELS[kind] }]
  };
}

function unwrapExpression(expression: ts.Expression): ts.Expression | null {
  if (ts.isParenthesizedExpression(expression)) return expression.expression;
  if (ts.isAsExpression(expression)) return expression.expression;
  if (ts.isTypeAssertionExpression(expression)) return expression.expression;
  if (ts.isNonNullExpression(expression)) return expression.expression;
  return null;
}

function firstTainted(values: TaintValue[]): TaintValue | null {
  return values.find((value) => value.tainted) ?? null;
}

export function evaluateTaintExpression(input: EvaluateTaintExpressionInput): TaintValue {
  const { expression, requestName, environment, sourceFile, budget } = input;
  if (!chargeTaintBudget(budget)) return safeValue();

  const sourceKind = requestSourceKind(expression, requestName);
  if (sourceKind) return sourceValue(sourceKind, expression, sourceFile, budget);

  if (ts.isIdentifier(expression)) {
    const value = environment.get(expression.text);
    if (!value?.tainted) return safeValue();
    return appendTrace(
      value,
      {
        kind: "propagation",
        line: lineOf(expression, sourceFile),
        label: "Propagation: local value"
      },
      budget
    );
  }

  const unwrapped = unwrapExpression(expression);
  if (unwrapped) {
    return evaluateTaintExpression({ ...input, expression: unwrapped });
  }

  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = evaluateTaintExpression({ ...input, expression: expression.left });
    if (budget.exceeded) return safeValue();
    const right = evaluateTaintExpression({ ...input, expression: expression.right });
    if (budget.exceeded) return safeValue();
    const value = firstTainted([left, right]);
    if (!value) return safeValue();
    return appendTrace(
      value,
      {
        kind: "propagation",
        line: lineOf(expression, sourceFile),
        label: "Propagation: string construction"
      },
      budget
    );
  }

  if (ts.isTemplateExpression(expression)) {
    const values: TaintValue[] = [];
    for (const span of expression.templateSpans) {
      values.push(evaluateTaintExpression({ ...input, expression: span.expression }));
      if (budget.exceeded) return safeValue();
    }
    const value = firstTainted(values);
    if (!value) return safeValue();
    return appendTrace(
      value,
      {
        kind: "propagation",
        line: lineOf(expression, sourceFile),
        label: "Propagation: string construction"
      },
      budget
    );
  }

  if (ts.isCallExpression(expression)) {
    if (ts.isIdentifier(expression.expression)) {
      const callee = expression.expression.text;
      const firstArgument = expression.arguments[0];

      if (NUMERIC_SANITIZERS.has(callee)) {
        if (!firstArgument) return safeValue();
        const value = evaluateTaintExpression({ ...input, expression: firstArgument });
        if (budget.exceeded) return safeValue();
        return unshadowedRuntimeGlobal(callee, sourceFile, budget) ? safeValue() : value;
      }

      if ((callee === "String" || callee === "encodeURIComponent") && firstArgument) {
        const value = evaluateTaintExpression({ ...input, expression: firstArgument });
        if (!value.tainted || budget.exceeded) return safeValue();
        return appendTrace(
          value,
          {
            kind: "propagation",
            line: lineOf(expression, sourceFile),
            label: "Propagation: string construction"
          },
          budget
        );
      }

      return safeValue();
    }

    if (ts.isPropertyAccessExpression(expression.expression)) {
      const method = expression.expression.name.text;
      if (!STRING_METHODS.has(method)) return safeValue();
      const value = evaluateTaintExpression({ ...input, expression: expression.expression.expression });
      if (!value.tainted || budget.exceeded) return safeValue();
      return appendTrace(
        value,
        {
          kind: "propagation",
          line: lineOf(expression, sourceFile),
          label: "Propagation: string construction"
        },
        budget
      );
    }
  }

  return safeValue();
}
