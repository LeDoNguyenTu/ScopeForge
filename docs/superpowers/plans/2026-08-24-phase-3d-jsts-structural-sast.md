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

## Security review adjustment

The initial plan included a candidate `jsts/insecure-cookie` rule based on response-like receiver names. Security review rejected that heuristic because variable names such as `res` or `response` do not prove framework identity. The candidate is therefore deferred to framework-aware analysis where a real binding can be established. Phase 3D ships only direct dynamic-code execution and recognized TLS-verification disablement. The `https.Agent({ rejectUnauthorized: false })` shape also requires a static binding to Node's `https` or `node:https` module so a local object merely named `https` cannot trigger the rule.

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

- [x] **Step 1: Write RED coordinator tests**

Add a scanner that returns one valid finding plus one structured diagnostic. Assert the finding remains in the result, the diagnostic becomes a `ScanError` with scanner/file/code fields, and an unrelated scanner still runs.

- [x] **Step 2: Write RED deterministic JSON tests**

Assert structured errors are sorted by scanner, file, code, and message and are serialized deterministically.

- [x] **Step 3: Implement compatible scanner output normalization**

In `runScan`, normalize an array return to `{ findings: array, errors: [] }`. For a structured result, sanitize every diagnostic message with the existing bounded error-message policy before appending it to `ScanResult.errors`.

- [x] **Step 4: Verify focused suites**

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

- [x] **Step 1: Write RED extension tests**
- [x] **Step 2: Write RED parse tests**
- [x] **Step 3: Implement parser with TypeScript compiler API**
- [x] **Step 4: Verify focused suite**

---

### Task 3: Add bounded iterative AST traversal and structural context

**Files:**
- Create: `packages/scanner-jsts/ast/traverse.ts`
- Create: `packages/scanner-jsts/ast/context.ts`
- Create: `tests/scanner/jsts/ast.test.ts`

**Interfaces:**
- `walkAst(sourceFile, visitor, { maxNodes }) -> { visitedNodes: number; exceeded: boolean }`.
- `structuralContext(node) -> string` returns a bounded semantic context such as `module`, `function:handler`, `method:login`, or `class:Service`.

- [x] **Step 1: Write RED traversal tests**
- [x] **Step 2: Write RED context tests**
- [x] **Step 3: Implement iterative traversal**
- [x] **Step 4: Implement bounded structural context**
- [x] **Step 5: Verify focused suite**

---

### Task 4: Implement the first high-confidence structural rules

**Files:**
- Create: `packages/scanner-jsts/rules/types.ts`
- Create: `packages/scanner-jsts/rules/builtin.ts`
- Create: `packages/scanner-jsts/findings/create-finding.ts`
- Create: `packages/scanner-jsts/scan-source.ts`
- Create: `tests/scanner/jsts/rules.test.ts`

**Shipped built-in rule IDs:**
- `jsts/dynamic-code-execution`
- `jsts/tls-verification-disabled`

**Deferred after security review:**
- `jsts/insecure-cookie` until framework identity can be established without receiver-name guessing.

- [x] **Step 1: Write RED dynamic-code tests**
- [x] **Step 2: Write RED TLS tests**
- [x] **Step 3: Add and review insecure-cookie candidate**

Security review added a negative regression proving response-like variable names can refer to unrelated APIs. The candidate was removed rather than weakening the regression.

- [x] **Step 4: Implement fixed rule metadata**

Dynamic code execution is medium severity/high confidence because the construct is observed while attacker control is not established. TLS verification disablement is high severity/high confidence when the exact recognized configuration is present.

- [x] **Step 5: Implement safe finding construction**
- [x] **Step 6: Implement rule matching by AST node kind**
- [x] **Step 7: Harden Node HTTPS binding recognition**

Require a recognized static `https`/`node:https` import or top-level `require` binding before accepting the `https.Agent({ rejectUnauthorized: false })` shape. Keep `process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0` independently detectable.

- [x] **Step 8: Verify focused suite**

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

- [x] **Step 1: Write RED repository integration test**
- [x] **Step 2: Write RED malformed-file isolation test**
- [x] **Step 3: Write RED AST-budget test**
- [x] **Step 4: Implement repository scanner**
- [x] **Step 5: Verify focused suite**

---

### Task 6: Register JS/TS built-ins in the CLI without weakening secret-scanner behavior

**Files:**
- Create: `packages/cli/builtins.ts`
- Modify: `packages/cli/run-cli.ts`
- Modify: `tests/scanner/cli/run-cli.test.ts`
- Create: `tests/scanner/jsts/no-source-leak.test.ts`

**Interfaces:**
- `BUILTIN_RULES` contains secret and shipped JS/TS rules in deterministic ID order.
- `createBuiltInScanners(config) -> Scanner[]` returns `secrets` and `jsts` by default.
- Existing global `rules.include` / `rules.exclude` selection applies to both families.

- [x] **Step 1: Write RED CLI rule-registry tests**
- [x] **Step 2: Write RED default-scan test**
- [x] **Step 3: Write RED configured-scanner selection test**
- [x] **Step 4: Write RED source-evidence leakage test**
- [x] **Step 5: Extract built-in registration**
- [x] **Step 6: Verify focused suites**

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

- [x] **Step 1: Correct Phase 3C post-merge state**
- [x] **Step 2: Review parser and traversal boundaries**
- [x] **Step 3: Review finding claims**
- [x] **Step 4: Review output safety and deterministic behavior**
- [ ] **Step 5: Run complete verification on the exact final head**

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

- framework-aware cookie/session checks until framework identity can be established structurally
- inter-file or source-to-sink taint propagation
- command-injection claims based only on child-process API presence
- SQL-injection claims based only on query API presence
- path-traversal claims without an untrusted source
- SSRF claims without an untrusted source
- framework-specific deep semantic models
- SCA, OSV, SBOM, IaC, baselines, SARIF, hosted ingestion, and all remote active scanning
