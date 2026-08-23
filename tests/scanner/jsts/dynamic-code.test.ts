import { describe, expect, it } from "vitest";

import { scanJavaScriptText } from "@/packages/scanner-jsts/scan-source";

describe("JavaScript dynamic-code structural rule", () => {
  it("detects direct eval and new Function syntax", () => {
    const findings = scanJavaScriptText({
      file: "src/runtime.ts",
      content: [
        "const a = eval(userCode);",
        "const b = new Function('value', 'return value');"
      ].join("\n")
    });

    expect(findings.map((finding) => finding.ruleId)).toEqual([
      "jsts/dynamic-code-execution",
      "jsts/dynamic-code-execution"
    ]);
    expect(findings.every((finding) => finding.validation === "static_confirmed")).toBe(true);
  });

  it("does not match comments, strings, or unrelated member calls", () => {
    const findings = scanJavaScriptText({
      file: "src/safe.ts",
      content: [
        "// eval(userCode)",
        "const text = 'new Function(unsafe)';",
        "sandbox.eval(userCode);",
        "const FunctionFactory = class Function {};"
      ].join("\n")
    });

    expect(findings).toEqual([]);
  });

  it("keeps the fingerprint stable when only preceding line numbers move", () => {
    const first = scanJavaScriptText({ file: "src/runtime.ts", content: "eval(userCode);\n" });
    const moved = scanJavaScriptText({ file: "src/runtime.ts", content: "\n\n\neval(userCode);\n" });

    expect(first[0]?.fingerprint).toBe(moved[0]?.fingerprint);
  });
});
