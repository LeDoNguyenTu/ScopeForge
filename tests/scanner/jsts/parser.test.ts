import { describe, expect, it } from "vitest";
import ts from "typescript";

import { parseJavaScriptSource } from "@/packages/scanner-jsts/parser/parse-source";

describe("parseJavaScriptSource", () => {
  it.each([
    ["src/app.js", ts.ScriptKind.JS],
    ["src/app.jsx", ts.ScriptKind.JSX],
    ["src/app.ts", ts.ScriptKind.TS],
    ["src/app.tsx", ts.ScriptKind.TSX]
  ])("parses %s with the expected script kind", (file, scriptKind) => {
    const parsed = parseJavaScriptSource({ file, content: "export const value = 1;\n" });

    expect(parsed.scriptKind).toBe(scriptKind);
    expect(parsed.sourceFile.fileName).toBe(file);
    expect(parsed.diagnostics).toEqual([]);
  });

  it("returns safe normalized diagnostics for malformed source", () => {
    const parsed = parseJavaScriptSource({
      file: "src/broken.ts",
      content: "export const broken = ;\n"
    });

    expect(parsed.diagnostics.length).toBeGreaterThan(0);
    expect(parsed.diagnostics[0]).toMatchObject({ line: 1 });
    expect(parsed.diagnostics[0]?.message.length).toBeGreaterThan(0);
    expect(JSON.stringify(parsed.diagnostics)).not.toContain("export const broken");
  });
});
