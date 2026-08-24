import { describe, expect, it } from "vitest";

import { parseSource } from "@/packages/scanner-jsts/parser/parse-source";
import { scanSourceFile } from "@/packages/scanner-jsts/scan-source";
import { scanCommandInjection } from "@/packages/scanner-jsts/taint/command-injection";

function parse(content: string) {
  const parsed = parseSource({ file: "src/app.ts", content });
  if (!("sourceFile" in parsed)) throw new Error("fixture should parse");
  return parsed.sourceFile;
}

function taint(content: string, maxSteps = 50_000) {
  return scanCommandInjection({ sourceFile: parse(content), maxSteps });
}

describe("Phase 3E taint security regressions", () => {
  it("skips bounded taint work cleanly when supported runtime modules are absent", () => {
    const filler = Array.from({ length: 200 }, (_, index) => `const value${index} = ${index};`).join("\n");
    const result = scanSourceFile({
      file: "src/app.ts",
      sourceFile: parse(`eval(userCode);\n${filler}\n`),
      maxNodes: 20_000,
      maxTaintSteps: 20
    });

    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["jsts/dynamic-code-execution"]);
    expect(result.error).toBeUndefined();
  });

  it("does not carry local taint across unsupported control-flow state changes", () => {
    const result = taint([
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "const app = express();",
      "app.get('/x', (req, res) => {",
      "  let command = req.query.cmd;",
      "  if (true) { command = 'echo safe'; }",
      "  exec(command);",
      "});"
    ].join("\n"));

    expect(result.findings).toEqual([]);
  });

  it("does not treat a nested binding that shadows the request parameter as Express input", () => {
    const result = taint([
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "const app = express();",
      "app.get('/x', (req, res) => {",
      "  if (true) {",
      "    const req = { query: { cmd: 'echo safe' } };",
      "    exec(req.query.cmd);",
      "  }",
      "});"
    ].join("\n"));

    expect(result.findings).toEqual([]);
  });

  it("does not trust a shadowed numeric conversion as a sanitizer", () => {
    const result = taint([
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "const Number = (value) => value;",
      "const app = express();",
      "app.get('/x', (req, res) => exec(Number(req.query.cmd)));"
    ].join("\n"));

    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["jsts/command-injection"]);
  });

  it("rejects a mutated CommonJS child_process namespace sink", () => {
    const result = taint([
      "const express = require('express');",
      "const cp = require('node:child_process');",
      "const app = express();",
      "cp.exec = fakeExec;",
      "app.get('/x', (req, res) => cp.exec(req.query.cmd));"
    ].join("\n"));

    expect(result.findings).toEqual([]);
  });

  it("rejects a mutated Express route method rather than assuming it is still framework code", () => {
    const result = taint([
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "const app = express();",
      "app.get = fakeRoute;",
      "app.get('/x', (req, res) => exec(req.query.cmd));"
    ].join("\n"));

    expect(result.findings).toEqual([]);
  });
});
