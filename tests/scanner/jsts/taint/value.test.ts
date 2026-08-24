import ts from "typescript";
import { describe, expect, it } from "vitest";

import { parseSource } from "@/packages/scanner-jsts/parser/parse-source";
import { evaluateTaintExpression } from "@/packages/scanner-jsts/taint/value";
import type { TaintBudget, TaintValue } from "@/packages/scanner-jsts/taint/types";

function expressionFrom(source: string): { expression: ts.Expression; sourceFile: ts.SourceFile } {
  const parsed = parseSource({ file: "src/app.ts", content: `const value = ${source};` });
  if (!("sourceFile" in parsed)) throw new Error(`fixture should parse: ${source}`);
  const statement = parsed.sourceFile.statements[0];
  if (!statement || !ts.isVariableStatement(statement)) throw new Error("fixture variable missing");
  const initializer = statement.declarationList.declarations[0]?.initializer;
  if (!initializer) throw new Error("fixture initializer missing");
  return { expression: initializer, sourceFile: parsed.sourceFile };
}

function evaluate(
  source: string,
  options: { requestName?: string; environment?: ReadonlyMap<string, TaintValue>; maxSteps?: number } = {}
) {
  const parsed = expressionFrom(source);
  const budget: TaintBudget = { maxSteps: options.maxSteps ?? 10_000, steps: 0 };
  const value = evaluateTaintExpression({
    expression: parsed.expression,
    requestName: options.requestName ?? "req",
    environment: options.environment ?? new Map(),
    sourceFile: parsed.sourceFile,
    budget
  });
  return { value, budget };
}

describe("Phase 3E taint expression values", () => {
  it("recognizes only fields below the proven Express request parameter", () => {
    const cases = [
      ["req.query.cmd", "express-query", "Source: Express query parameter"],
      ["req.params.id", "express-params", "Source: Express route parameter"],
      ["req.body.command", "express-body", "Source: Express request body field"],
      ["req.query['cmd']", "express-query", "Source: Express query parameter"]
    ] as const;

    for (const [source, kind, label] of cases) {
      const { value } = evaluate(source);
      expect(value.tainted).toBe(true);
      expect(value.origin?.kind).toBe(kind);
      expect(value.trace[0]?.label).toBe(label);
    }

    for (const source of ["query.cmd", "requestLike.body.cmd", "res.query.cmd", "req.query", "req.body"]) {
      expect(evaluate(source).value.tainted).toBe(false);
    }
  });

  it("propagates through supported string-preserving expression shapes", () => {
    const sources = [
      "(req.query.cmd)",
      "req.query.cmd as string",
      "(<string>req.query.cmd)",
      "req.query.cmd!",
      "'prefix ' + req.query.cmd",
      "`${req.params.id}`",
      "String(req.body.command)",
      "req.query.cmd.trim()",
      "req.query.cmd.toLowerCase()",
      "req.query.cmd.toUpperCase()",
      "encodeURIComponent(req.query.cmd)",
      "req.query.cmd.replace(/x/g, 'y')"
    ];

    for (const source of sources) {
      const { value } = evaluate(source);
      expect(value.tainted, source).toBe(true);
      expect(value.trace.every((step) => !step.label.includes("req.query.cmd"))).toBe(true);
    }
  });

  it("propagates environment aliases with a normalized local-value trace", () => {
    const origin = evaluate("req.query.cmd").value;
    const environment = new Map<string, TaintValue>([["command", origin]]);
    const { value } = evaluate("command", { environment });

    expect(value.tainted).toBe(true);
    expect(value.origin?.kind).toBe("express-query");
    expect(value.trace.at(-1)?.label).toBe("Propagation: local value");
  });

  it("treats numeric conversions as command-injection sanitizers", () => {
    for (const source of [
      "Number(req.query.cmd)",
      "parseInt(req.params.id, 10)",
      "parseFloat(req.body.command)"
    ]) {
      expect(evaluate(source).value.tainted, source).toBe(false);
    }
  });

  it("stops at unknown helper calls rather than guessing their return taint", () => {
    for (const source of ["sanitize(req.query.cmd)", "customTransform(req.body.command)"]) {
      expect(evaluate(source).value.tainted, source).toBe(false);
    }
  });

  it("marks the shared taint budget exceeded instead of returning partial taint", () => {
    const { value, budget } = evaluate("'prefix ' + req.query.cmd", { maxSteps: 1 });
    expect(value.tainted).toBe(false);
    expect(budget.exceeded).toBe(true);
  });
});
