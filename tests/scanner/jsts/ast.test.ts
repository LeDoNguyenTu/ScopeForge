import { describe, expect, it } from "vitest";
import ts from "typescript";

import { structuralContext } from "@/packages/scanner-jsts/ast/context";
import { walkAst } from "@/packages/scanner-jsts/ast/traverse";
import { parseSource } from "@/packages/scanner-jsts/parser/parse-source";

function source(content: string) {
  const parsed = parseSource({ file: "src/app.ts", content });
  if (!("sourceFile" in parsed)) throw new Error("fixture should parse");
  return parsed.sourceFile;
}

function evalCall(content: string): ts.CallExpression {
  const sourceFile = source(content);
  let found: ts.CallExpression | undefined;
  walkAst(sourceFile, (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "eval") {
      found ??= node;
    }
  }, { maxNodes: 10_000 });
  if (!found) throw new Error("fixture should contain eval call");
  return found;
}

describe("bounded AST traversal", () => {
  it("visits source nodes deterministically and stops at the node budget", () => {
    const sourceFile = source("function run() { const a = 1; const b = 2; return a + b; }\n");
    const first: number[] = [];
    const second: number[] = [];

    const complete = walkAst(sourceFile, (node) => first.push(node.kind), { maxNodes: 10_000 });
    const repeated = walkAst(sourceFile, (node) => second.push(node.kind), { maxNodes: 10_000 });
    expect(complete.exceeded).toBe(false);
    expect(repeated.exceeded).toBe(false);
    expect(first).toEqual(second);

    const bounded = walkAst(sourceFile, () => undefined, { maxNodes: 3 });
    expect(bounded.exceeded).toBe(true);
    expect(bounded.visitedNodes).toBe(3);
  });

  it("derives semantic context that is stable across line movement", () => {
    expect(structuralContext(evalCall("eval(code);\n"))).toBe("module");
    expect(structuralContext(evalCall("function handler() { eval(code); }\n"))).toBe("function:handler");
    expect(structuralContext(evalCall("const handler = () => { eval(code); };\n"))).toBe("function:handler");
    expect(structuralContext(evalCall("class Service { login() { eval(code); } }\n"))).toBe("method:login");

    const before = structuralContext(evalCall("function handler() { eval(code); }\n"));
    const moved = structuralContext(evalCall("\n// moved\n\nfunction handler() { eval(code); }\n"));
    expect(moved).toBe(before);
  });
});
