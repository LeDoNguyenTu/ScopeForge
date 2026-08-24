# Phase 3E JavaScript and TypeScript Command Taint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ScopeForge's first bounded high-confidence source-to-sink JavaScript/TypeScript finding by proving Express request input reaches a statically bound Node `child_process.exec` or `execSync` command sink within the same route handler.

**Architecture:** Extend the existing `scanner-jsts` package rather than creating a second language scanner. A narrow taint layer will first prove runtime framework and sink bindings, identify inline Express route handlers structurally, then run bounded forward intra-handler propagation over a deliberately small expression vocabulary. Structural SAST remains independent, and a taint-budget failure discards only partial taint findings while preserving already-valid structural findings from the same file.

**Tech Stack:** Node.js 22, TypeScript 5.8 compiler API, TypeScript 5.8, Vitest 3.2, existing ScopeForge scanner contracts, Node built-ins only beyond existing dependencies.

**Spec:** `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`

## Global Constraints

- Phase 3 remains local and passive.
- Never execute repository code, imported modules, package lifecycle scripts, Dockerfiles, Terraform, Kubernetes manifests, or workflows.
- Never install target dependencies.
- Do not create a command-injection finding from API presence alone. A supported request source must reach a supported shell-command sink through an observed modeled flow.
- Framework identity and module identity must be established structurally from runtime imports or a narrowly supported unshadowed CommonJS `require` binding. Variable names alone are not evidence.
- Type-only imports never establish runtime identity.
- All repository reads remain behind `readInventoryEntry`.
- The existing per-file AST node budget remains enforced.
- Taint analysis gets a separate fixed per-file step budget. If it is exceeded, partial taint findings from that file are discarded and a structured scanner diagnostic is returned.
- Initial propagation is intra-file and intra-handler only. Whole-program and cross-file data flow remain out of scope.
- Unknown function calls stop propagation unless explicitly modeled as a safe-preserving transform or sanitizer.
- Finding evidence and data-flow labels use normalized descriptors, never arbitrary repository source lines.
- Existing secret redaction and JS/TS source-leak protections remain unchanged.
- Default CI remains report-only. Existing policy semantics do not change.
- CI must pass `npm test`, `npm run typecheck`, `npm run build:cli`, `node .scopeforge-build/packages/cli/index.js version`, and `npm run build` before merge.

---

### Task 1: Establish trusted Express and child-process runtime bindings

**Files:**
- Create: `packages/scanner-jsts/taint/types.ts`
- Create: `packages/scanner-jsts/taint/bindings.ts`
- Test: `tests/scanner/jsts/taint/bindings.test.ts`

**Interfaces:**
- `TaintBudget { maxSteps: number; steps: number }`
- `ExpressRouteHandler { callback: ts.ArrowFunction | ts.FunctionExpression; requestName: string; routeMethod: string }`
- `CommandSinkBinding` describes either a direct local `exec`/`execSync` identifier or a namespace receiver bound to `child_process`/`node:child_process`.
- `collectTaintBindings(sourceFile, budget) -> { routeHandlers: ExpressRouteHandler[]; commandSinks: CommandSinkBinding[]; exceeded: boolean }`.

- [ ] **Step 1: Write RED runtime-binding tests**

Cover these positive forms:

```ts
import express from "express";
import { exec as run } from "node:child_process";
const app = express();
app.get("/run", (req, res) => run(req.query.cmd));
```

```ts
const express = require("express");
const cp = require("node:child_process");
const app = express();
app.post("/run", (request, response) => cp.execSync(request.body.cmd));
```

Also cover `Router` imported from Express and `express.Router()`.

- [ ] **Step 2: Write RED identity-negative tests**

Assert no trusted route/sink binding is created for:

```ts
const express = fakeFramework;
const app = express();
```

```ts
import type express from "express";
```

```ts
const require = fakeRequire;
const express = require("express");
```

```ts
const cp = { exec() {} };
```

and for runtime bindings that are shadowed by another declaration of the same identifier.

- [ ] **Step 3: Implement bounded binding collection**

Recognize only runtime imports from `express`, `child_process`, and `node:child_process`; top-level `const` CommonJS bindings are allowed only when the global `require` name is unshadowed. Recognize inline route-handler callbacks on statically proven Express app/router instances. For route methods, support `get`, `post`, `put`, `patch`, `delete`, `all`, and `use`; the first callback parameter is the request identifier only after the receiver has been proven as an Express app/router.

- [ ] **Step 4: Verify focused suite**

Run: `npm test -- tests/scanner/jsts/taint/bindings.test.ts`
Expected: PASS.

---

### Task 2: Model the initial request-source and expression taint vocabulary

**Files:**
- Create: `packages/scanner-jsts/taint/value.ts`
- Test: `tests/scanner/jsts/taint/value.test.ts`

**Interfaces:**
- `TaintOrigin { kind: "express-query" | "express-params" | "express-body"; line: number }`
- `TaintTraceStep { kind: "source" | "propagation" | "sink"; line: number; label: string }`
- `TaintValue { tainted: boolean; origin?: TaintOrigin; trace: TaintTraceStep[] }`
- `evaluateTaintExpression({ expression, requestName, environment, sourceFile, budget }) -> TaintValue`.

- [ ] **Step 1: Write RED direct-source tests**

Treat only property/element access below the proven request parameter as sources:

```ts
req.query.cmd
req.params.id
req.body.command
req.query["cmd"]
```

Do not treat unrelated `query.cmd`, `requestLike.body.cmd`, or a second response parameter as request input.

- [ ] **Step 2: Write RED propagation tests**

Propagate taint through parentheses, `as`/type assertions, non-null expressions, string concatenation, template interpolation, `String(value)`, and `.trim()` / `.toLowerCase()` / `.toUpperCase()` calls on an already-tainted value. Unknown function calls stop propagation.

- [ ] **Step 3: Write RED sanitizer tests**

Treat `Number(tainted)`, `parseInt(tainted, 10)`, and `parseFloat(tainted)` as command-injection sanitizers because their returned value is numeric. Do not treat `encodeURIComponent`, `replace`, or an arbitrary `sanitize()` function as a modeled shell-command sanitizer.

- [ ] **Step 4: Implement normalized traces**

Source labels must be fixed strings such as `Source: Express query parameter`, `Source: Express route parameter`, and `Source: Express request body field`. Propagation labels must be fixed strings such as `Propagation: local value` or `Propagation: string construction`; do not include source snippets or attacker-controlled values.

- [ ] **Step 5: Verify focused suite**

Run: `npm test -- tests/scanner/jsts/taint/value.test.ts`
Expected: PASS.

---

### Task 3: Add bounded forward intra-handler propagation

**Files:**
- Create: `packages/scanner-jsts/taint/analyze-handler.ts`
- Test: `tests/scanner/jsts/taint/analyze-handler.test.ts`

**Interfaces:**
- `HandlerTaintResult { sinkFlows: CommandTaintFlow[]; exceeded: boolean }`
- `CommandTaintFlow { sinkNode: ts.CallExpression; sink: "child_process.exec" | "child_process.execSync"; source: TaintOrigin; trace: TaintTraceStep[] }`
- `analyzeExpressHandler({ handler, requestName, commandSinks, sourceFile, budget }) -> HandlerTaintResult`.

- [ ] **Step 1: Write RED direct and alias flow tests**

Cover:

```ts
exec(req.query.cmd);
```

```ts
const command = req.body.command;
exec(command);
```

```ts
let command = "echo safe";
command = req.params.command;
execSync(`prefix ${command}`);
```

- [ ] **Step 2: Write RED no-flow tests**

Assert no flow for a constant command, a variable assigned only from trusted literals, a request source passed through `Number`, a call to `execFile`/`spawn`, or request data passed only to an unknown helper that is never modeled as returning tainted data.

- [ ] **Step 3: Implement straight-line statement propagation**

Support variable declarations and simple identifier assignments in source order. Analyze direct expression-statement sink calls and sink calls used as initializers/return expressions. Do not merge speculative branch state in this first slice. For unsupported control-flow constructs, analyze direct source-to-sink expressions inside the construct only when no local-state inference is required; otherwise stop propagation rather than guessing.

- [ ] **Step 4: Enforce the taint step budget**

Increment the budget for each binding inspected, statement processed, expression evaluated, and trace edge recorded. When `maxSteps` is exceeded, return `exceeded: true` and no sink flows for that file-level taint run.

- [ ] **Step 5: Verify focused suite**

Run: `npm test -- tests/scanner/jsts/taint/analyze-handler.test.ts`
Expected: PASS.

---

### Task 4: Emit the first source-to-sink command-injection finding

**Files:**
- Create: `packages/scanner-jsts/findings/create-taint-finding.ts`
- Create: `packages/scanner-jsts/taint/command-injection.ts`
- Modify: `packages/scanner-jsts/rules/builtin.ts`
- Modify: `packages/scanner-jsts/scan-source.ts`
- Test: `tests/scanner/jsts/taint/command-injection.test.ts`

**Interfaces:**
- New rule ID: `jsts/command-injection`.
- Rule version: `1.0.0`.
- Severity: `high`.
- Confidence: `high` only for the supported proven flow.
- CWE: `CWE-78`.
- OWASP: `A03:2021`.
- `scanCommandInjection({ sourceFile, rules, maxSteps }) -> { findings: Finding[]; error?: ScannerDiagnostic }`.

- [ ] **Step 1: Write RED end-to-end finding tests**

A proven Express request source flowing to a statically bound `exec`/`execSync` must produce one `jsts/command-injection` finding at the sink location. The finding must have `validation: "static_confirmed"`, high confidence, and data-flow steps ordered from source to sink.

- [ ] **Step 2: Write RED false-positive tests**

No command-injection finding for fake Express objects, fake child-process objects, type-only imports, shadowed runtime names, a non-Express callback with parameters named `req`/`res`, numeric conversion, `execFile`, or a sink that receives only a literal.

- [ ] **Step 3: Write RED evidence/fingerprint tests**

Finding evidence must use `request input -> child_process.exec(...)` or `request input -> child_process.execSync(...)`. Data-flow labels must not contain a distinctive unrelated source sentinel. Fingerprints must remain stable when comments/blank lines move above the handler and must distinguish two supported flows in the same semantic handler.

- [ ] **Step 4: Implement taint finding construction**

Fingerprint with scanner `jsts`, rule `jsts/command-injection`, repository-relative path, structural handler context, normalized source class, normalized sink class, and deterministic occurrence. Location is the sink call. `evidence.dataFlow` maps normalized trace steps into the shared `DataFlowStep` contract using the repository-relative file and fixed labels.

- [ ] **Step 5: Integrate without weakening structural SAST**

Run existing structural matching first. Run command taint only when `jsts/command-injection` is enabled. If taint analysis exceeds its budget, retain already-complete structural findings but emit `taint_budget_exceeded` and discard partial command-taint findings.

- [ ] **Step 6: Verify focused suites**

Run: `npm test -- tests/scanner/jsts/rules.test.ts tests/scanner/jsts/taint/command-injection.test.ts`
Expected: PASS.

---

### Task 5: Thread the taint budget through the repository scanner and CLI registry

**Files:**
- Modify: `packages/scanner-jsts/scanner.ts`
- Modify: `packages/scanner-jsts/index.ts`
- Modify: `packages/cli/builtins.ts`
- Modify: `tests/scanner/jsts/scanner.test.ts`
- Modify: `tests/scanner/jsts/cli.test.ts`
- Create: `tests/scanner/jsts/taint/no-source-leak.test.ts`

**Interfaces:**
- Extend `CreateJstsScannerOptions` with `maxTaintSteps?: number`.
- Default `maxTaintSteps`: `50_000` per file.
- Invalid taint budgets fail scanner construction rather than silently disabling analysis.

- [ ] **Step 1: Write RED repository budget-isolation test**

Construct one file that deliberately exceeds a tiny taint budget and one valid structural/taint file. Assert the over-budget file yields `taint_budget_exceeded`, no partial command-injection finding from that file, and findings from the other file remain present.

- [ ] **Step 2: Write RED CLI rule-list and scanner-selection tests**

Assert `scopeforge rules list` contains `jsts/command-injection` in deterministic ID order and unknown rule IDs still fail closed. Existing `scanners: ["jsts"]` and `scanners: ["secrets"]` behavior must remain unchanged.

- [ ] **Step 3: Write RED terminal/JSON no-source-leak test**

Scan a file containing an unrelated unique sentinel plus a supported command flow. Assert terminal output, JSON output, finding evidence, scanner errors, and data-flow labels do not contain the sentinel or request-controlled value.

- [ ] **Step 4: Implement scanner budget plumbing**

Pass `maxTaintSteps` from `createJstsScanner` to `scanSourceFile`. Always ingest completed `scanned.findings`; if `scanned.error` is present, also append the diagnostic. This preserves structural findings when only the taint budget is exhausted.

- [ ] **Step 5: Verify focused suites**

Run: `npm test -- tests/scanner/jsts/scanner.test.ts tests/scanner/jsts/cli.test.ts tests/scanner/jsts/taint/no-source-leak.test.ts`
Expected: PASS.

---

### Task 6: Security review and adversarial binding fixtures

**Files:**
- Modify: `tests/scanner/jsts/taint/bindings.test.ts`
- Modify: `tests/scanner/jsts/taint/command-injection.test.ts`
- Modify production files only when a new RED regression demonstrates a real defect.

- [ ] **Step 1: Review name-only inference**

Add negatives for local `express`, `app`, `router`, `req`, `exec`, `execSync`, `child_process`, and `require` names that are not backed by the supported runtime bindings.

- [ ] **Step 2: Review shadowing and type-only imports**

Add negatives for handler-local shadowing, duplicate module binding names, type-only Express imports, type-only child-process imports, and shadowed CommonJS `require`.

- [ ] **Step 3: Review propagation overclaiming**

Add negatives for unknown helper returns, unsupported destructuring/control-flow patterns, and values overwritten by a trusted literal before the sink. ScopeForge must prefer a missed finding to a speculative source-to-sink claim in unsupported semantics.

- [ ] **Step 4: Review resource bounds**

Confirm every taint path is charged against `maxTaintSteps`, no unbounded recursive repository traversal was introduced, and budget failure cannot serialize partial taint results as confirmed findings.

- [ ] **Step 5: Review evidence safety**

Confirm no source line, request-controlled string value, arbitrary identifier payload, or imported module contents appear in terminal/JSON evidence or scanner diagnostics.

---

### Task 7: Documentation and exact-head merge gate

**Files:**
- Modify: `README.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/IMPLEMENTATION_LOG.md`
- Modify: this plan to record completed checklist state.

- [ ] **Step 1: Record Phase 3D merge state**

Record PR #9 as merged into `main` as `462266be22ad36692d8c47ef1942aeb2c94493b4` and make Phase 3E the current slice.

- [ ] **Step 2: Document the exact supported taint semantics**

Document that Phase 3E proves only supported Express request sources to supported Node `exec`/`execSync` sinks with bounded intra-handler propagation. Explicitly document unsupported cross-file/whole-program analysis and conservative stop-propagation behavior.

- [ ] **Step 3: Run complete verification**

Run: `npm test`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build:cli`
Expected: PASS.

Run: `node .scopeforge-build/packages/cli/index.js version`
Expected: `ScopeForge 0.1.0`.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Verify exact PR head and merge only when green**

Require no unresolved Critical/Important review blockers and use expected-head protection for the squash merge. If the head moves after CI, verify the new head before merging.

---

## Deferred from Phase 3E

The following remain deliberately outside this slice:

- SQL injection, path traversal, SSRF, and unsafe-HTML taint rules
- framework-sensitive cookie/session findings
- named route-handler resolution unless added later through a separate proven local-binding task
- cross-file or whole-program propagation
- broad interprocedural propagation through arbitrary user functions
- speculative sanitizers or validation inferred from function names
- dependency/OSV scanning, SBOM, IaC, baselines, SARIF, hosted ingestion, and all remote active scanning
