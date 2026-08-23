import { describe, expect, it } from "vitest";

import { parseSource } from "@/packages/scanner-jsts/parser/parse-source";
import { scanSourceFile } from "@/packages/scanner-jsts/scan-source";
import { scanCommandInjection } from "@/packages/scanner-jsts/taint/command-injection";

function parse(content: string) {
  const parsed = parseSource({ file: "src/app.ts", content });
  if (!("sourceFile" in parsed)) throw new Error("fixture should parse");
  return parsed.sourceFile;
}

function scan(content: string, maxSteps = 50_000) {
  return scanCommandInjection({
    sourceFile: parse(content),
    rules: undefined,
    maxSteps
  });
}

describe("Phase 3E command injection finding", () => {
  it("emits one high-confidence static finding for a proven Express request-to-exec flow", () => {
    const result = scan([
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "const app = express();",
      "app.get('/run', (req, res) => exec(req.query.cmd));"
    ].join("\n"));

    expect(result.error).toBeUndefined();
    expect(result.findings).toHaveLength(1);
    const finding = result.findings[0];
    expect(finding?.ruleId).toBe("jsts/command-injection");
    expect(finding?.severity).toBe("high");
    expect(finding?.confidence).toBe("high");
    expect(finding?.validation).toBe("static_confirmed");
    expect(finding?.cwe).toEqual(["CWE-78"]);
    expect(finding?.evidence.redactedSnippet).toBe("request input -> child_process.exec(...)");
    expect(finding?.evidence.dataFlow?.map((step) => step.label)).toEqual([
      "Source: Express query parameter",
      "Sink: child_process.exec"
    ]);
    expect(finding?.location.startLine).toBe(4);
  });

  it("emits execSync alias flows with normalized propagation evidence", () => {
    const result = scan([
      "import express from 'express';",
      "import { execSync as runSync } from 'child_process';",
      "const app = express();",
      "app.post('/run', (request, response) => {",
      "  const command = request.body.command;",
      "  runSync(`prefix ${command}`);",
      "});"
    ].join("\n"));

    expect(result.findings).toHaveLength(1);
    const finding = result.findings[0];
    expect(finding?.evidence.redactedSnippet).toBe("request input -> child_process.execSync(...)");
    expect(finding?.evidence.dataFlow?.map((step) => step.label)).toEqual([
      "Source: Express request body field",
      "Propagation: local value",
      "Propagation: string construction",
      "Sink: child_process.execSync"
    ]);
  });

  it("does not emit findings from name-only or unsupported flows", () => {
    const fixtures = [
      [
        "const express = fakeFramework;",
        "const app = express();",
        "const exec = fakeExec;",
        "app.get('/x', (req, res) => exec(req.query.cmd));"
      ],
      [
        "import type express from 'express';",
        "import type { exec } from 'node:child_process';",
        "const app = express();",
        "app.get('/x', (req, res) => exec(req.query.cmd));"
      ],
      [
        "import express from 'express';",
        "const cp = { exec() {} };",
        "const app = express();",
        "app.get('/x', (req, res) => cp.exec(req.query.cmd));"
      ],
      [
        "import { exec } from 'node:child_process';",
        "const callback = (req, res) => exec(req.query.cmd);"
      ],
      [
        "import express from 'express';",
        "import { exec } from 'node:child_process';",
        "const app = express();",
        "app.get('/x', (req, res) => exec(String(Number(req.query.cmd))));"
      ],
      [
        "import express from 'express';",
        "import { execFile } from 'node:child_process';",
        "const app = express();",
        "app.get('/x', (req, res) => execFile(req.query.cmd));"
      ],
      [
        "import express from 'express';",
        "import { exec } from 'node:child_process';",
        "const app = express();",
        "app.get('/x', (req, res) => exec('echo safe'));"
      ],
      [
        "import express from 'express';",
        "import { exec } from 'node:child_process';",
        "function wrapper(express: unknown, exec: unknown) { return [express, exec]; }",
        "const app = express();",
        "app.get('/x', (req, res) => exec(req.query.cmd));"
      ]
    ];

    for (const fixture of fixtures) {
      expect(scan(fixture.join("\n")).findings, fixture.join("\n")).toEqual([]);
    }
  });

  it("keeps evidence source-safe and fingerprints stable across line movement", () => {
    const sentinel = "UNRELATED_TAINT_SENTINEL_41a9";
    const base = [
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "const app = express();",
      `const note = '${sentinel}';`,
      "app.get('/run', (req, res) => exec(req.params.command));"
    ].join("\n");
    const moved = [
      "",
      "// moved comment",
      "",
      base
    ].join("\n");

    const first = scan(base).findings;
    const second = scan(moved).findings;
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0]?.fingerprint).toBe(second[0]?.fingerprint);
    expect(JSON.stringify(first[0])).not.toContain(sentinel);
    expect(JSON.stringify(first[0]?.evidence.dataFlow)).not.toContain("command");
  });

  it("distinguishes repeated supported flows in the same route handler", () => {
    const findings = scan([
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "const app = express();",
      "app.get('/run', (req, res) => {",
      "  exec(req.query.first);",
      "  exec(req.query.second);",
      "});"
    ].join("\n")).findings;

    expect(findings).toHaveLength(2);
    expect(findings[0]?.fingerprint).not.toBe(findings[1]?.fingerprint);
  });

  it("preserves completed structural findings when only taint analysis exceeds budget", () => {
    const result = scanSourceFile({
      file: "src/app.ts",
      sourceFile: parse([
        "import express from 'express';",
        "import { exec } from 'node:child_process';",
        "const app = express();",
        "eval(userCode);",
        "app.get('/run', (req, res) => { const command = req.query.cmd; exec(command); });"
      ].join("\n")),
      maxNodes: 50_000,
      maxTaintSteps: 1
    });

    expect(result.findings.map((finding) => finding.ruleId)).toContain("jsts/dynamic-code-execution");
    expect(result.findings.map((finding) => finding.ruleId)).not.toContain("jsts/command-injection");
    expect(result.error?.code).toBe("taint_budget_exceeded");
  });
});
