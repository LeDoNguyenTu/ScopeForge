# Phase 3D JavaScript and TypeScript Structural SAST Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ScopeForge's first syntax-aware JavaScript and TypeScript SAST scanner with a bounded TypeScript-compiler parser boundary, explicit per-file analysis errors, and a small high-confidence structural rule set.

**Architecture:** Use the already-installed TypeScript 5.8 compiler API to parse JavaScript, TypeScript, JSX, TSX, MJS, CJS, MTS, and CTS as data without executing repository code. Extend the scanner coordinator compatibly so scanners may return findings plus structured per-file errors, allowing malformed or resource-exhausting files to fail closed while other files continue. Register the new `jsts` scanner beside `secrets` through a small CLI built-ins registry.

**Tech Stack:** Node.js 22, TypeScript 5.8 compiler API, TypeScript 5.8, Vitest 3.2, Node built-ins only beyond the existing TypeScript package.

**Spec:** `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`

## Global Constraints

- Phase 3 remains local and passive.
- Never execute repository code, package lifecycle scripts, Dockerfiles, Terraform, Kubernetes manifests, or workflows.
- Never install target dependencies.
- All repository reads use `readInventoryEntry`; the JS/TS scanner never walks or opens paths independently.
- Parse only inventory entries classified as JavaScript or TypeScript source.
- Parsing and traversal are bounded; one malformed or over-budget file must not look like a clean analysis result.
- Parser diagnostics must not include arbitrary repository source text.
- Initial structural rules must be high-confidence and must not claim taint or exploitability that has not been proven.
- Command injection, SQL injection, path traversal, SSRF, and other source-to-sink claims are deferred to the later taint slice.
- Finding evidence uses normalized construct descriptions, not unrelated raw source lines.
- Fingerprints use stable structural context and do not depend only on line numbers.
- Existing secret redaction, configuration, policy, and exit-code guarantees remain unchanged.
- CI must continue to pass `npm test`, `npm run typecheck`, `npm run build:cli`, the compiled CLI runtime smoke, and `npm run build`.

---

### Task 1: Allow scanners to report partial analysis errors without discarding valid findings

**Files:**
- Modify: `packages/scanner-core/coordinator/types.ts`
- Modify: `packages/scanner-core/coordinator/run-scan.ts`
- Modify: `packages/scanner-core/findings/types.ts`
- Modify: `packages/scanner-output/json/serialize.ts`
- Test: `tests/scanner/coordinator/run-scan.test.ts`
- Test: `tests/scanner/output/json.test.ts`

**Interfaces:**
- Add `ScannerDiagnostic { code: string; file?: string; message: string }`.
- Add `ScannerRunResult { findings: Finding[]; errors: ScannerDiagnostic[] }`.
- Change `Scanner.scan(...)` to return `Promise<Finding[] | ScannerRunResult>` so the existing secret scanner remains source-compatible.
- Extend `ScanError` with optional `code` and `file` fields populated by the coordinator, while the coordinator always supplies the authoritative scanner name.

- [ ] **Step 1: Write RED coordinator tests**

Add a scanner that returns one valid finding plus one structured diagnostic. Assert the finding remains in the result, the diagnostic becomes a `ScanError` with scanner/file/code fields, and an unrelated scanner still runs.

- [ ] **Step 2: Write RED deterministic JSON tests**

Assert structured errors are sorted by scanner, file, code, and message and are serialized deterministically.

- [ ] **Step 3: Implement compatible scanner output normalization**

In `runScan`, normalize an array return to `{ findings: array, errors: [] }`. For a structured result, sanitize every diagnostic message with the existing bounded error-message policy before appending it to `ScanResult.errors`.

- [ ] **Step 4: Verify focused suites**

Run: `npm test -- tests/scanner/coordinator/run-scan.test.ts tests/scanner/output/json.test.ts`

Expected: PASS.

---

### Task 2: Add a bounded execution-free TypeScript parser boundary

**Files:**
- Create: `packages/scanner-jsts/parser/script-kind.ts`
- Create: `packages/scanner-jsts/parser/parse-source.ts`
- Create: `packages/scanner-jsts/parser/types.ts`
- Create: `tests/scanner/jsts/parser.test.ts`

**Interfaces:**
- `scriptKindForPath(path: string) -> ts.ScriptKind | null`.
- `parseSource({ file, content }) -> { sourceFile: ts.SourceFile } | { error: ParserError }`.
- `ParserError` contains only `code: "syntax_error" | "unsupported_extension"` and a bounded generic message.

- [ ] **Step 1: Write RED extension tests**

Cover `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, and `.cts`; unsupported extensions return null.

- [ ] **Step 2: Write RED parse tests**

Parse valid JavaScript, TypeScript, JSX, and TSX without executing it. Add a syntactically malformed fixture and assert parsing returns `syntax_error` rather than a usable AST.

- [ ] **Step 3: Implement parser with TypeScript compiler API**

Use `typescript.createSourceFile(file, content, ts.ScriptTarget.Latest, true, scriptKind)`. If syntax diagnostics are present, return a generic bounded syntax-error result containing file identity but no copied source line.

- [ ] **Step 4: Verify focused suite**

Run: `npm test -- tests/scanner/jsts/parser.test.ts`

Expected: PASS.

---

### Task 3: Add bounded iterative AST traversal and structural context

**Files:**
- Create: `packages/scanner-jsts/ast/traverse.ts`
- Create: `packages/scanner-jsts/ast/context.ts`
- Create: `tests/scanner/jsts/ast.test.ts`

**Interfaces:**
- `walkAst(sourceFile, visitor, { maxNodes }) -> { visitedNodes: number; exceeded: boolean }`.
- `structuralContext(node) -> string` returns a bounded semantic context such as `module`, `function:handler`, `method:login`, or `class:Service`.

- [ ] **Step 1: Write RED traversal tests**

Assert deterministic source-order visitation, no recursive visitor requirement, and an explicit `exceeded` result when a very small node budget is reached.

- [ ] **Step 2: Write RED context tests**

Cover top-level, named function, arrow function assigned to a variable, class method, and class contexts. Assert context is stable when blank lines/comments are inserted above the construct.

- [ ] **Step 3: Implement iterative traversal**

Use an explicit node stack and `ts.forEachChild` only to enqueue direct children. Push children in reverse so visitation remains source-order. Stop before invoking the visitor after `maxNodes` is exceeded.

- [ ] **Step 4: Implement bounded structural context**

Walk parent links to the nearest named function/method/class/variable-assigned function. Normalize identifier text and cap it to 96 characters; never use a raw statement as context.

- [ ] **Step 5: Verify focused suite**

Run: `npm test -- tests/scanner/jsts/ast.test.ts`

Expected: PASS.

---

### Task 4: Implement the first high-confidence structural rules

**Files:**
- Create: `packages/scanner-jsts/rules/types.ts`
- Create: `packages/scanner-jsts/rules/builtin.ts`
- Create: `packages/scanner-jsts/findings/create-finding.ts`
- Create: `packages/scanner-jsts/scan-source.ts`
- Create: `tests/scanner/jsts/rules.test.ts`

**Interfaces:**
- Built-in rule IDs:
  - `jsts/dynamic-code-execution`
  - `jsts/tls-verification-disabled`
  - `jsts/insecure-cookie`
- `scanSourceFile({ file, sourceFile, rules, maxNodes }) -> { findings: Finding[]; error?: ScannerDiagnostic }`.

- [ ] **Step 1: Write RED dynamic-code tests**

Detect direct `eval(...)` calls and `new Function(...)` expressions. Do not match comment text, string literals, object property names, or identifiers merely containing `eval`/`Function`.

- [ ] **Step 2: Write RED TLS tests**

Detect explicit `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` or numeric `0`, and `new https.Agent({ rejectUnauthorized: false })`. Do not flag `rejectUnauthorized: true` or unrelated object properties with the same name.

- [ ] **Step 3: Write RED insecure-cookie tests**

Detect recognized response cookie calls such as `res.cookie(name, value, { secure: false })` and `response.cookie(...)` when the options object explicitly sets `secure: false`. Do not flag `secure: true`, omitted secure options, or unrelated `.cookie` APIs whose receiver name is not a recognized response identifier.

- [ ] **Step 4: Implement fixed rule metadata**

Each rule has version `1.0.0`, bounded title/description/remediation, high confidence for the observed construct, and severity appropriate to the construct. No rule description claims attacker-controlled data flow.

- [ ] **Step 5: Implement safe finding construction**

Use `createFindingFingerprint` with scanner `jsts`, rule ID, repository path, normalized enclosing context, rule-specific sink, and a deterministic per-context occurrence number. Evidence uses fixed descriptors such as `eval(...)`, `new Function(...)`, `NODE_TLS_REJECT_UNAUTHORIZED=0`, `https.Agent({ rejectUnauthorized: false })`, or `response.cookie(..., { secure: false })`; do not copy the source line.

- [ ] **Step 6: Implement rule matching by AST node kind**

Match exact AST shapes only. Traverse once and dispatch candidate nodes to enabled rules. Findings are sorted deterministically by the shared finding comparator.

- [ ] **Step 7: Verify focused suite**

Run: `npm test -- tests/scanner/jsts/rules.test.ts`

Expected: PASS.

---

### Task 5: Build the repository JS/TS scanner with syntax-error and resource-budget isolation

**Files:**
- Create: `packages/scanner-jsts/scanner.ts`
- Create: `packages/scanner-jsts/index.ts`
- Create: `tests/scanner/jsts/scanner.test.ts`

**Interfaces:**
- `createJstsScanner({ rules?, maxAstNodes? }) -> Scanner`.
- Scanner name: `jsts`.
- Scanner version: `1.0.0`.
- Default AST node budget: `200_000` nodes per file.

- [ ] **Step 1: Write RED repository integration test**

Build a temporary inventory containing JS, TS, TSX, non-source files, and an ignored source file. Assert only inventory source entries are parsed and findings are deterministic.

- [ ] **Step 2: Write RED malformed-file isolation test**

Include one malformed source file and one valid vulnerable source file. Assert the scanner returns the valid finding plus a structured `syntax_error` diagnostic for the malformed file.

- [ ] **Step 3: Write RED AST-budget test**

Construct the scanner with a deliberately tiny `maxAstNodes` and assert the affected file yields `ast_budget_exceeded`, no partial findings from that file, and other files continue.

- [ ] **Step 4: Implement repository scanner**

Filter inventory entries by supported JS/TS source extension. Read each candidate only through `readInventoryEntry`. Treat NUL-containing source as an explicit `unsupported_binary_source` diagnostic. Parse, scan, and collect per-file results without throwing for expected hostile-input parse/resource failures.

- [ ] **Step 5: Verify focused suite**

Run: `npm test -- tests/scanner/jsts/scanner.test.ts`

Expected: PASS.

---

### Task 6: Register JS/TS built-ins in the CLI without weakening secret-scanner behavior

**Files:**
- Create: `packages/cli/builtins.ts`
- Modify: `packages/cli/run-cli.ts`
- Modify: `tests/scanner/cli/run-cli.test.ts`
- Create: `tests/scanner/jsts/no-source-leak.test.ts`

**Interfaces:**
- `BUILTIN_RULES` contains secret and JS/TS rules in deterministic ID order.
- `createBuiltInScanners(config) -> Scanner[]` returns `secrets` and `jsts` by default.
- Existing global `rules.include` / `rules.exclude` selection applies to both families.

- [ ] **Step 1: Write RED CLI rule-registry tests**

Assert `scopeforge rules list` includes all five secret rules plus the three JS/TS rules, sorted by rule ID. Unknown JS/TS rule IDs fail closed with exit code 2.

- [ ] **Step 2: Write RED default-scan test**

Scan a temporary repository containing one synthetic secret and one structural JS/TS issue. Assert both scanner families run by default and both findings appear without changing report-only exit behavior.

- [ ] **Step 3: Write RED configured-scanner selection test**

With root config `scanners: ["jsts"]`, assert the JS/TS finding is present and the secret finding is absent. With `scanners: ["secrets"]`, assert the reverse.

- [ ] **Step 4: Write RED source-evidence leakage test**

Put a distinctive unrelated sentinel string in the same source file as a structural issue. Serialize the finding and terminal/JSON outputs and assert the sentinel is absent while the fixed structural evidence is present.

- [ ] **Step 5: Extract built-in registration**

Move combined rule registry, unknown-rule validation data, and default scanner construction into `packages/cli/builtins.ts`. Keep custom `RunCliOptions.scanners` behavior unchanged for tests and embedding.

- [ ] **Step 6: Verify focused suites**

Run: `npm test -- tests/scanner/cli/run-cli.test.ts tests/scanner/jsts/no-source-leak.test.ts`

Expected: PASS.

---

### Task 7: Full security review, docs, and final merge gate

**Files:**
- Modify: `README.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/IMPLEMENTATION_LOG.md`

- [ ] **Step 1: Correct Phase 3C post-merge state**

Record PR #8 as merged into `main` as `ee2b18c37d264fc22e47e650970e66d01f7c92dd` before describing Phase 3D.

- [ ] **Step 2: Review parser and traversal boundaries**

Confirm the JS/TS scanner uses no `require`/dynamic import of repository code, no `Program.emit`, no type-checker module resolution, no package installation, no filesystem access outside `readInventoryEntry`, a fixed node budget, and iterative traversal.

- [ ] **Step 3: Review finding claims**

Confirm structural findings describe observed insecure constructs only and do not claim attacker-controlled flow. Ensure command/SQL/path/SSRF source-to-sink vulnerabilities are still deferred.

- [ ] **Step 4: Review output safety and deterministic behavior**

Confirm parser diagnostics and evidence do not copy arbitrary repository source content, fingerprints do not depend only on line numbers, and JSON error ordering remains deterministic.

- [ ] **Step 5: Run complete verification**

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

- [ ] **Step 6: Verify exact PR head and merge only when green**

Require no unresolved Critical/Important review blockers and use expected-head protection for the merge. If the head moves after CI, verify the new head before merging.

---

## Deferred from Phase 3D

The following remain deliberately out of this slice:

- inter-file or source-to-sink taint propagation
- command-injection claims based only on child-process API presence
- SQL-injection claims based only on query API presence
- path-traversal claims without an untrusted source
- SSRF claims without an untrusted source
- framework-specific deep semantic models beyond the narrow cookie/TLS shapes above
- SCA, OSV, SBOM, IaC, baselines, SARIF, hosted ingestion, and all remote active scanning
