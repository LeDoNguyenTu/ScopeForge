# ScopeForge Test Status

| Check | Result | Evidence / notes |
|---|---|---|
| Phase 3D implementation checkpoint | Passing | CI #152 on `41f2e331b829b7914c18de139ed0e04dd0f99b53` |
| Vitest | Passing | 30 test files, 141 tests on CI #152 |
| TypeScript strict typecheck | Passing | CI #152 |
| CLI TypeScript build | Passing | `npm run build:cli` on CI #152 |
| Compiled CLI runtime smoke | Passing | `node .scopeforge-build/packages/cli/index.js version` printed `ScopeForge 0.1.0` on CI #152 |
| Next.js production build | Passing | CI #152 |
| Coordinator partial-error tests | Passing | structured per-file scanner errors preserve valid findings and sanitize messages |
| Deterministic JSON error tests | Passing | scanner/file/code/message ordering is deterministic |
| JS/TS parser tests | Passing | JS, JSX, MJS, CJS, TS, TSX, MTS, CTS plus generic syntax-error isolation |
| AST traversal tests | Passing | iterative deterministic walk, fixed node budget, stable semantic context |
| Structural rule tests | Passing | direct dynamic execution, recognized TLS disablement, recognized insecure cookies, negative fixtures |
| JS/TS scanner integration | Passing | bounded inventory reads, ignored/non-source filtering, syntax isolation, node-budget isolation, rule selection |
| No-execution regression | Passing | target imports, `require`, and filesystem side-effect code are parsed as data and never executed |
| Source-evidence no-leak | Passing | unrelated source sentinel absent from terminal, JSON, and finding evidence |
| CLI integration | Passing | default `secrets` + `jsts`, deterministic rules list, scanner-family selection, unknown-rule fail-closed behavior |
| Secret scanner regression suite | Passing | Phase 3C secret behavior remains green after coordinator union support |
| Remote active scanning | Disabled | Phase 3 remains local/passive |

## TDD and debugging evidence

- CI #132: Phase 3D RED checkpoint. Existing behavior stayed healthy while the new JS/TS contracts failed because production modules and registration were absent.
- CI #150: all 141 runtime tests passed. Strict typecheck then isolated two type-contract problems rather than detector defects.
- Type fix 1: TypeScript runtime parse diagnostics remain accessed only at the parser boundary through a narrow compatibility type because `SourceFile.parseDiagnostics` is not exposed on the public 5.8 type.
- Type fix 2: `createSecretScanner` now preserves its narrower `Promise<Finding[]>` return type while remaining assignable to the coordinator's compatible scanner union.
- CI #152: all 141 tests, strict typecheck, CLI build/runtime smoke, and production build passed.

## Final merge rule

PR #9 must not merge unless its exact final documentation head passes `npm test`, `npm run typecheck`, `npm run build:cli`, the compiled CLI runtime smoke command, and `npm run build`. Any repository-execution path, unbounded traversal regression, arbitrary source-text leakage, false clean result, or unjustified source-to-sink vulnerability claim blocks merge.
