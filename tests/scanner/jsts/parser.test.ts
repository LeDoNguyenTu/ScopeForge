import { describe, expect, it } from "vitest";
import ts from "typescript";

import { parseSource } from "@/packages/scanner-jsts/parser/parse-source";
import { scriptKindForPath } from "@/packages/scanner-jsts/parser/script-kind";

describe("JavaScript and TypeScript parser boundary", () => {
  it.each([
    ["src/app.js", ts.ScriptKind.JS],
    ["src/app.jsx", ts.ScriptKind.JSX],
    ["src/app.mjs", ts.ScriptKind.JS],
    ["src/app.cjs", ts.ScriptKind.JS],
    ["src/app.ts", ts.ScriptKind.TS],
    ["src/app.tsx", ts.ScriptKind.TSX],
    ["src/app.mts", ts.ScriptKind.TS],
    ["src/app.cts", ts.ScriptKind.TS]
  ])("maps %s to the expected script kind", (file, expected) => {
    expect(scriptKindForPath(file)).toBe(expected);
  });

  it("rejects unsupported extensions", () => {
    expect(scriptKindForPath("src/app.py")).toBeNull();
  });

  it.each([
    ["src/app.js", "export const value = 1;\n"],
    ["src/app.jsx", "export const View = () => <div />;\n"],
    ["src/app.ts", "export const value: number = 1;\n"],
    ["src/app.tsx", "export const View = (): JSX.Element => <div />;\n"]
  ])("parses %s as data without an analysis error", (file, content) => {
    const result = parseSource({ file, content });
    expect("sourceFile" in result).toBe(true);
    if ("sourceFile" in result) expect(result.sourceFile.fileName).toBe(file);
  });

  it("returns a bounded syntax error without retaining source content", () => {
    const content = "export const BROKEN_SENTINEL = ;\n";
    const result = parseSource({ file: "src/broken.ts", content });

    expect(result).toEqual({
      error: {
        code: "syntax_error",
        message: "Source file contains syntax errors."
      }
    });
    expect(JSON.stringify(result)).not.toContain("BROKEN_SENTINEL");
  });
});
