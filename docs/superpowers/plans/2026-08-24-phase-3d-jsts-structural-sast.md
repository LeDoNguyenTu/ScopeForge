# Phase 3D JavaScript and TypeScript Structural SAST Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ScopeForge's first syntax-aware JavaScript and TypeScript SAST scanner with a safe parser boundary and a small high-confidence structural rule set.

**Architecture:** Use the existing TypeScript compiler parser directly with `createSourceFile`, without constructing a `Program`, resolving imports, loading project configuration, or executing repository code. The scanner consumes only Phase 3 inventory entries through `readInventoryEntry`, reports malformed source as an informational analysis finding, and emits normalized ScopeForge findings through the existing coordinator and CLI.

**Tech Stack:** Node.js 22, TypeScript 5.8 compiler API, Vitest 3.2. No new parser dependency.

**Spec:** `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`

## Global Constraints

- Phase 3 remains local and passive.
- Never execute repository code or package lifecycle scripts.
- Never resolve or load target imports/modules as part of parsing.
- Every repository content read uses `readInventoryEntry`.
- Parse JavaScript, JSX, TypeScript, and TSX as data only.
- One malformed source file must not abort scanning of other files or disappear silently from coverage.
- Findings use stable structural fingerprints and deterministic ordering.
- Initial rules favor direct, high-confidence syntax patterns. Taint propagation is explicitly deferred.
- Existing secret redaction and scanner error boundaries remain unchanged.

---

### Task 1: Add a parser-only boundary

**Files:**
- Create: `packages/scanner-jsts/parser/types.ts`
- Create: `packages/scanner-jsts/parser/parse-source.ts`
- Create: `tests/scanner/jsts/parser.test.ts`

**Interfaces:**
- Produces: `parseJavaScriptSource({ file, content }) -> ParsedJavaScriptSource`.
- `ParsedJavaScriptSource` contains the TypeScript `SourceFile`, script kind, and normalized syntax diagnostics.
- It must never construct a TypeScript `Program` or resolve modules.

- [ ] Write tests for JS, JSX, TS, TSX script-kind selection and a malformed-source diagnostic.
- [ ] Verify RED because parser modules do not exist.
- [ ] Implement with `typescript.createSourceFile` and extension-based `ScriptKind`.
- [ ] Normalize diagnostics to safe messages and locations without serializing unrelated source content.
- [ ] Verify focused tests GREEN.

### Task 2: Add rule registry and normalized finding builder

**Files:**
- Create: `packages/scanner-jsts/rules/types.ts`
- Create: `packages/scanner-jsts/rules/builtin.ts`
- Create: `packages/scanner-jsts/findings/build-finding.ts`
- Create: `tests/scanner/jsts/findings.test.ts`

**Interfaces:**
- Rule IDs:
  - `jsts/dynamic-code-execution`
  - `jsts/unsafe-child-process`
  - `jsts/tls-verification-disabled`
  - `jsts/parse-error`
- Produces deterministic findings using `createFindingFingerprint` with stable structural context rather than line number identity.

- [ ] Write RED finding tests for stable fingerprints across line movement and bounded evidence.
- [ ] Implement versioned rule metadata and AST-node location helpers.
- [ ] Keep evidence concise, structural, and independent from unrelated file text.
- [ ] Verify focused tests GREEN.

### Task 3: Detect dynamic code execution structurally

**Files:**
- Create: `packages/scanner-jsts/rules/dynamic-code.ts`
- Create: `packages/scanner-jsts/scan-source.ts`
- Create: `tests/scanner/jsts/dynamic-code.test.ts`

**Behavior:**
- Detect direct `eval(...)` call expressions.
- Detect `new Function(...)` constructor expressions.
- Do not match strings/comments containing those words.
- Do not claim taint or exploitability.

- [ ] Write positive and negative AST tests.
- [ ] Verify RED.
- [ ] Implement syntax-node checks only.
- [ ] Verify GREEN.

### Task 4: Detect unsafe child-process execution structurally

**Files:**
- Create: `packages/scanner-jsts/rules/child-process.ts`
- Modify: `packages/scanner-jsts/scan-source.ts`
- Create: `tests/scanner/jsts/child-process.test.ts`

**Behavior:**
- Track direct ES imports and CommonJS destructuring/member access from `node:child_process` and `child_process`.
- Detect `exec(...)` and `execSync(...)` calls.
- Detect `spawn(...)` and `spawnSync(...)` only when statically configured with `{ shell: true }`.
- Do not infer request-data taint in this slice.
- Avoid matching unrelated local functions named `exec` unless tied to child-process import/require structure.

- [ ] Write positive/negative import and require fixtures.
- [ ] Verify RED.
- [ ] Implement bounded intra-file binding recognition with no module resolution.
- [ ] Verify GREEN.

### Task 5: Detect statically disabled TLS verification

**Files:**
- Create: `packages/scanner-jsts/rules/tls.ts`
- Modify: `packages/scanner-jsts/scan-source.ts`
- Create: `tests/scanner/jsts/tls.test.ts`

**Behavior:**
- Detect object properties `rejectUnauthorized: false`.
- Detect direct assignment of string `"0"` to `process.env.NODE_TLS_REJECT_UNAUTHORIZED`.
- Do not flag `rejectUnauthorized: true`, dynamic values, or unrelated similarly named strings.

- [ ] Write positive/negative AST tests.
- [ ] Verify RED.
- [ ] Implement direct static-value checks.
- [ ] Verify GREEN.

### Task 6: Build repository scanner and parse-error isolation

**Files:**
- Create: `packages/scanner-jsts/scanner.ts`
- Create: `packages/scanner-jsts/index.ts`
- Create: `tests/scanner/jsts/scanner.test.ts`

**Behavior:**
- Scan inventory source entries classified as JavaScript or TypeScript only.
- Read every source through `readInventoryEntry`.
- Skip NUL-containing content.
- A syntax diagnostic produces one informational `jsts/parse-error` finding for that file and scanning continues for other files.
- Rule include/exclude selection uses the existing root config rule selection.
- Findings remain deterministic and fingerprint-deduplicated.

- [ ] Write repository integration tests with one malformed file and one vulnerable valid file.
- [ ] Verify RED.
- [ ] Implement scanner and exports.
- [ ] Verify GREEN.

### Task 7: Register JS/TS SAST in the CLI

**Files:**
- Modify: `packages/cli/run-cli.ts`
- Modify: `tests/scanner/cli/run-cli.test.ts`
- Create: `tests/scanner/jsts/no-execution.test.ts`

**Behavior:**
- Default built-in scanner set becomes `secrets` plus `jsts`.
- `scopeforge rules list` includes both registries.
- Unknown rule IDs still fail closed across all built-in registries.
- Tests prove parsing does not execute top-level repository code, lifecycle scripts, or imported modules.

- [ ] Write RED CLI/rule-registry tests.
- [ ] Write a hostile fixture whose execution would create a marker file, then assert scanning never creates it.
- [ ] Register scanner/rules without adding module resolution.
- [ ] Run full suite, typecheck, CLI build/runtime smoke, and Next.js build.

### Task 8: Review, documentation, and merge gate

**Files:**
- Modify: `README.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/IMPLEMENTATION_LOG.md`

- [ ] Review parser code for any `Program`, module-resolution, execution, dynamic import, or filesystem bypass.
- [ ] Review rule identity/evidence for deterministic and bounded output.
- [ ] Update shipped/not-shipped documentation accurately.
- [ ] Require exact-head CI across tests, typecheck, CLI build/runtime smoke, and production build.
- [ ] Merge only with no unresolved Critical or Important review blocker.
