import { describe, expect, it } from "vitest";

import { parseSource } from "@/packages/scanner-jsts/parser/parse-source";
import { scanSourceFile } from "@/packages/scanner-jsts/scan-source";

function scan(content: string, file = "src/app.ts") {
  const parsed = parseSource({ file, content });
  if (!("sourceFile" in parsed)) throw new Error("fixture should parse");
  const result = scanSourceFile({ file, sourceFile: parsed.sourceFile, maxNodes: 50_000 });
  expect(result.error).toBeUndefined();
  return result.findings;
}

describe("JavaScript and TypeScript structural rules", () => {
  it("detects direct eval and new Function without matching text or member calls", () => {
    const findings = scan([
      "const a = eval(userCode);",
      "const b = new Function('value', 'return value');",
      "sandbox.eval(userCode);",
      "const text = 'eval(userCode) new Function(x)';",
      "// eval(commentOnly);"
    ].join("\n"));

    expect(findings.map((finding) => finding.ruleId)).toEqual([
      "jsts/dynamic-code-execution",
      "jsts/dynamic-code-execution"
    ]);
    expect(findings[0]?.evidence.redactedSnippet).toBe("eval(...)");
    expect(findings[1]?.evidence.redactedSnippet).toBe("new Function(...)");
  });

  it("detects explicit TLS verification disablement only in recognized Node.js shapes", () => {
    const findings = scan([
      "import * as https from 'node:https';",
      "process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';",
      "const agent = new https.Agent({ rejectUnauthorized: false });",
      "const safeAgent = new https.Agent({ rejectUnauthorized: true });",
      "const unrelated = { rejectUnauthorized: false };",
      "process.env.NODE_TLS_REJECT_UNAUTHORIZED = configuredValue;"
    ].join("\n"));

    expect(findings.map((finding) => finding.ruleId)).toEqual([
      "jsts/tls-verification-disabled",
      "jsts/tls-verification-disabled"
    ]);

    const cjs = scan([
      "const https = require('node:https');",
      "new https.Agent({ rejectUnauthorized: false });"
    ].join("\n"));
    expect(cjs.map((finding) => finding.ruleId)).toEqual(["jsts/tls-verification-disabled"]);

    const fakeModule = scan([
      "const https = { Agent: class Agent {} };",
      "new https.Agent({ rejectUnauthorized: false });"
    ].join("\n"));
    expect(fakeModule).toEqual([]);
  });

  it("requires a runtime Node HTTPS binding rather than type-only or shadowed require syntax", () => {
    const typeOnly = scan([
      "import type * as https from 'node:https';",
      "new https.Agent({ rejectUnauthorized: false });"
    ].join("\n"));
    expect(typeOnly).toEqual([]);

    const shadowedRequire = scan([
      "const require = () => ({ Agent: class Agent {} });",
      "const https = require('node:https');",
      "new https.Agent({ rejectUnauthorized: false });"
    ].join("\n"));
    expect(shadowedRequire).toEqual([]);
  });

  it("does not treat shadowed global or module names as security-sensitive bindings", () => {
    const findings = scan([
      "import * as https from 'node:https';",
      "function localBindings(eval, process, https) {",
      "  eval(userCode);",
      "  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';",
      "  new https.Agent({ rejectUnauthorized: false });",
      "}",
      "const Function = class LocalFunction {};",
      "new Function();"
    ].join("\n"));

    expect(findings).toEqual([]);
  });

  it("does not infer an HTTP framework from response-like variable names alone", () => {
    const findings = scan([
      "const res = customCookieJar();",
      "res.cookie('session', token, { secure: false });",
      "const response = customCookieJar();",
      "response.cookie('other', token, { secure: false });"
    ].join("\n"));

    expect(findings).toEqual([]);
  });

  it("keeps fingerprints stable across line movement and distinct for repeated constructs", () => {
    const first = scan("function handler() { eval(a); eval(b); }\n");
    const moved = scan("\n// comment moved\n\nfunction handler() { eval(a); eval(b); }\n");

    expect(first.map((finding) => finding.fingerprint)).toEqual(moved.map((finding) => finding.fingerprint));
    expect(first[0]?.fingerprint).not.toBe(first[1]?.fingerprint);
  });

  it("does not copy unrelated source text into finding evidence", () => {
    const sentinel = "UNRELATED_SOURCE_SENTINEL_9f2a";
    const findings = scan(`const note = '${sentinel}';\neval(userCode);\n`);
    expect(findings).toHaveLength(1);
    expect(JSON.stringify(findings)).not.toContain(sentinel);
  });
});
