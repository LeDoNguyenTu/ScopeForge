import { describe, expect, it } from "vitest";

import { parseSource } from "@/packages/scanner-jsts/parser/parse-source";
import { analyzeExpressHandler } from "@/packages/scanner-jsts/taint/analyze-handler";
import { collectTaintBindings } from "@/packages/scanner-jsts/taint/bindings";
import type { TaintBudget } from "@/packages/scanner-jsts/taint/types";

function analyze(content: string, maxSteps = 10_000) {
  const parsed = parseSource({ file: "src/app.ts", content });
  if (!("sourceFile" in parsed)) throw new Error("fixture should parse");

  const bindingBudget: TaintBudget = { maxSteps: 10_000, steps: 0 };
  const bindings = collectTaintBindings(parsed.sourceFile, bindingBudget);
  expect(bindings.exceeded).toBe(false);
  expect(bindings.routeHandlers).toHaveLength(1);

  const handler = bindings.routeHandlers[0];
  if (!handler) throw new Error("fixture handler missing");
  const budget: TaintBudget = { maxSteps, steps: 0 };
  const result = analyzeExpressHandler({
    handler: handler.callback,
    requestName: handler.requestName,
    commandSinks: bindings.commandSinks,
    sourceFile: parsed.sourceFile,
    budget
  });
  return { result, budget };
}

describe("Phase 3E Express handler taint propagation", () => {
  it("finds a direct request-to-exec flow", () => {
    const { result } = analyze([
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "const app = express();",
      "app.get('/run', (req, res) => exec(req.query.cmd));"
    ].join("\n"));

    expect(result.exceeded).toBe(false);
    expect(result.sinkFlows).toHaveLength(1);
    expect(result.sinkFlows[0]?.sink).toBe("child_process.exec");
    expect(result.sinkFlows[0]?.source.kind).toBe("express-query");
    expect(result.sinkFlows[0]?.trace.map((step) => step.kind)).toEqual(["source", "sink"]);
  });

  it("propagates request data through a local alias", () => {
    const { result } = analyze([
      "import express from 'express';",
      "import { exec as run } from 'child_process';",
      "const app = express();",
      "app.post('/run', (req, res) => {",
      "  const command = req.body.command;",
      "  run(command);",
      "});"
    ].join("\n"));

    expect(result.sinkFlows).toHaveLength(1);
    expect(result.sinkFlows[0]?.source.kind).toBe("express-body");
    expect(result.sinkFlows[0]?.trace.map((step) => step.label)).toContain("Propagation: local value");
  });

  it("tracks simple reassignment and string construction to execSync", () => {
    const { result } = analyze([
      "import express from 'express';",
      "import { execSync } from 'node:child_process';",
      "const app = express();",
      "app.patch('/run', (req, res) => {",
      "  let command = 'echo safe';",
      "  command = req.params.command;",
      "  execSync(`prefix ${command}`);",
      "});"
    ].join("\n"));

    expect(result.sinkFlows).toHaveLength(1);
    expect(result.sinkFlows[0]?.sink).toBe("child_process.execSync");
    expect(result.sinkFlows[0]?.source.kind).toBe("express-params");
    expect(result.sinkFlows[0]?.trace.map((step) => step.label)).toContain("Propagation: string construction");
  });

  it("recognizes namespace child_process sinks", () => {
    const { result } = analyze([
      "const express = require('express');",
      "const cp = require('node:child_process');",
      "const app = express();",
      "app.post('/run', function (request, response) {",
      "  cp.execSync(request.body.command);",
      "});"
    ].join("\n"));

    expect(result.sinkFlows).toHaveLength(1);
    expect(result.sinkFlows[0]?.sink).toBe("child_process.execSync");
  });

  it("does not invent flow through trusted values, numeric conversion, unsupported sinks, or unknown helpers", () => {
    const fixtures = [
      [
        "import express from 'express';",
        "import { exec } from 'node:child_process';",
        "const app = express();",
        "app.get('/x', (req, res) => exec('echo safe'));"
      ],
      [
        "import express from 'express';",
        "import { exec } from 'node:child_process';",
        "const app = express();",
        "app.get('/x', (req, res) => { const command = 'echo safe'; exec(command); });"
      ],
      [
        "import express from 'express';",
        "import { exec } from 'node:child_process';",
        "const app = express();",
        "app.get('/x', (req, res) => exec(String(Number(req.query.cmd))));"
      ],
      [
        "import express from 'express';",
        "import { execFile, spawn } from 'node:child_process';",
        "const app = express();",
        "app.get('/x', (req, res) => { execFile(req.query.cmd); spawn(req.query.cmd); });"
      ],
      [
        "import express from 'express';",
        "import { exec } from 'node:child_process';",
        "const app = express();",
        "app.get('/x', (req, res) => exec(helper(req.query.cmd)));"
      ]
    ];

    for (const fixture of fixtures) {
      expect(analyze(fixture.join("\n")).result.sinkFlows).toEqual([]);
    }
  });

  it("clears taint when a local is overwritten by a trusted literal", () => {
    const { result } = analyze([
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "const app = express();",
      "app.get('/x', (req, res) => {",
      "  let command = req.query.cmd;",
      "  command = 'echo safe';",
      "  exec(command);",
      "});"
    ].join("\n"));

    expect(result.sinkFlows).toEqual([]);
  });

  it("fails closed and discards partial flows when the taint budget is exceeded", () => {
    const { result, budget } = analyze([
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "const app = express();",
      "app.get('/x', (req, res) => { const a = req.query.cmd; const b = a; exec(b); });"
    ].join("\n"), 2);

    expect(result.exceeded).toBe(true);
    expect(result.sinkFlows).toEqual([]);
    expect(budget.exceeded).toBe(true);
  });
});
