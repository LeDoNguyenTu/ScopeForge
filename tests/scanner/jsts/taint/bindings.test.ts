import { describe, expect, it } from "vitest";

import { parseSource } from "@/packages/scanner-jsts/parser/parse-source";
import { collectTaintBindings } from "@/packages/scanner-jsts/taint/bindings";
import type { TaintBudget } from "@/packages/scanner-jsts/taint/types";

function collect(content: string) {
  const parsed = parseSource({ file: "src/app.ts", content });
  if (!("sourceFile" in parsed)) throw new Error("fixture should parse");
  const budget: TaintBudget = { maxSteps: 10_000, steps: 0 };
  return collectTaintBindings(parsed.sourceFile, budget);
}

describe("Phase 3E taint runtime bindings", () => {
  it("trusts runtime Express app handlers and aliased child_process named imports", () => {
    const result = collect([
      "import express from 'express';",
      "import { exec as run } from 'node:child_process';",
      "const app = express();",
      "app.get('/run', (req, res) => run(req.query.cmd));"
    ].join("\n"));

    expect(result.exceeded).toBe(false);
    expect(result.routeHandlers).toHaveLength(1);
    expect(result.routeHandlers[0]?.requestName).toBe("req");
    expect(result.routeHandlers[0]?.routeMethod).toBe("get");
    expect(result.commandSinks).toContainEqual({
      kind: "direct",
      localName: "run",
      method: "exec"
    });
  });

  it("trusts top-level unshadowed CommonJS Express and child_process namespace bindings", () => {
    const result = collect([
      "const express = require('express');",
      "const cp = require('node:child_process');",
      "const app = express();",
      "app.post('/run', (request, response) => cp.execSync(request.body.cmd));"
    ].join("\n"));

    expect(result.routeHandlers).toHaveLength(1);
    expect(result.routeHandlers[0]?.requestName).toBe("request");
    expect(result.routeHandlers[0]?.routeMethod).toBe("post");
    expect(result.commandSinks).toContainEqual({
      kind: "namespace",
      localName: "cp"
    });
  });

  it("recognizes Express Router imports and express.Router instances", () => {
    const namedRouter = collect([
      "import { Router } from 'express';",
      "import { execSync } from 'child_process';",
      "const router = Router();",
      "router.put('/run', (req, res) => execSync(req.params.id));"
    ].join("\n"));

    expect(namedRouter.routeHandlers.map((handler) => [handler.routeMethod, handler.requestName])).toEqual([
      ["put", "req"]
    ]);
    expect(namedRouter.commandSinks).toContainEqual({
      kind: "direct",
      localName: "execSync",
      method: "execSync"
    });

    const namespaceRouter = collect([
      "import express from 'express';",
      "import * as cp from 'node:child_process';",
      "const router = express.Router();",
      "router.delete('/run', (request, response) => cp.exec(request.query.cmd));"
    ].join("\n"));

    expect(namespaceRouter.routeHandlers.map((handler) => [handler.routeMethod, handler.requestName])).toEqual([
      ["delete", "request"]
    ]);
    expect(namespaceRouter.commandSinks).toContainEqual({ kind: "namespace", localName: "cp" });
  });

  it("rejects fake, type-only, and shadowed framework or sink identities", () => {
    const fakeFramework = collect([
      "const express = fakeFramework;",
      "const app = express();",
      "const cp = { exec() {} };",
      "app.get('/run', (req, res) => cp.exec(req.query.cmd));"
    ].join("\n"));
    expect(fakeFramework.routeHandlers).toEqual([]);
    expect(fakeFramework.commandSinks).toEqual([]);

    const typeOnly = collect([
      "import type express from 'express';",
      "import type { exec } from 'node:child_process';",
      "const app = express();",
      "app.get('/run', (req, res) => exec(req.query.cmd));"
    ].join("\n"));
    expect(typeOnly.routeHandlers).toEqual([]);
    expect(typeOnly.commandSinks).toEqual([]);

    const shadowedRequire = collect([
      "const require = fakeRequire;",
      "const express = require('express');",
      "const cp = require('node:child_process');",
      "const app = express();",
      "app.get('/run', (req, res) => cp.exec(req.query.cmd));"
    ].join("\n"));
    expect(shadowedRequire.routeHandlers).toEqual([]);
    expect(shadowedRequire.commandSinks).toEqual([]);
  });

  it("rejects duplicated runtime names rather than guessing which declaration wins", () => {
    const result = collect([
      "import express from 'express';",
      "import { exec } from 'node:child_process';",
      "function wrapper(express: unknown, exec: unknown) { return [express, exec]; }",
      "const app = express();",
      "app.get('/run', (req, res) => exec(req.query.cmd));"
    ].join("\n"));

    expect(result.routeHandlers).toEqual([]);
    expect(result.commandSinks).toEqual([]);
  });

  it("fails closed when the taint binding budget is exhausted", () => {
    const parsed = parseSource({
      file: "src/app.ts",
      content: "import express from 'express'; const app = express(); app.get('/x', (req, res) => res.send('ok'));"
    });
    if (!("sourceFile" in parsed)) throw new Error("fixture should parse");

    const budget: TaintBudget = { maxSteps: 1, steps: 0 };
    const result = collectTaintBindings(parsed.sourceFile, budget);

    expect(result.exceeded).toBe(true);
    expect(result.routeHandlers).toEqual([]);
    expect(result.commandSinks).toEqual([]);
  });
});
