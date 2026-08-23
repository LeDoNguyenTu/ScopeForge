# ScopeForge Test Status

| Check | Result | Evidence / notes |
|---|---|---|
| Phase 3D implementation checkpoint | Passing | CI #152 on `41f2e331b829b7914c18de139ed0e04dd0f99b53` |
| Vitest implementation checkpoint | Passing | 30 test files, 141 tests on CI #152 |
| TypeScript strict typecheck | Passing | CI #152 |
| CLI TypeScript build | Passing | `npm run build:cli` on CI #152 |
| Compiled CLI runtime smoke | Passing | `node .scopeforge-build/packages/cli/index.js version` printed `ScopeForge 0.1.0` on CI #152 |
| Next.js production build | Passing | CI #152 |
| Coordinator partial-error tests | Passing | structured per-file scanner errors preserve valid findings and sanitize messages |
| Deterministic JSON error tests | Passing | scanner/file/code/message ordering is deterministic |
| JS/TS parser tests | Passing | JS, JSX, MJS, CJS, TS, TSX, MTS, CTS plus generic syntax-error isolation |
| AST traversal tests | Passing | iterative deterministic walk, fixed node budget, stable semantic context |
| Structural rule tests | Review hardened | direct dynamic execution plus recognized TLS disablement; framework-name-only cookie inference is rejected |
| Node HTTPS binding regression | RED then fixed | CI #164 showed a fake local `https` object triggered the Agent rule; implementation now requires a static `https`/`node:https` binding |
| JS/TS scanner integration | Fixture corrected after hardening | CI #165 showed rule-selection fixture lacked the newly required Node HTTPS binding; fixture now imports `node:https` explicitly |
| No-execution regression | Passing at implementation checkpoint | target imports, `require`, and filesystem side-effect code are parsed as data and never executed |
| Source-evidence no-leak | Passing at implementation checkpoint | unrelated source sentinel absent from terminal, JSON, and finding evidence |
| CLI integration | Passing at implementation checkpoint | default `secrets` + `jsts`, deterministic rules list, scanner-family selection, unknown-rule fail-closed behavior |
| Secret scanner regression suite | Passing at implementation checkpoint | Phase 3C secret behavior remains green after coordinator union support |
| Remote active scanning | Disabled | Phase 3 remains local/passive |

## TDD and debugging evidence

- CI #132: Phase 3D RED checkpoint. Existing behavior stayed healthy while the new JS/TS contracts failed because production modules and registration were absent.
- CI #150: all 141 runtime tests passed. Strict typecheck then isolated two type-contract problems rather than detector defects.
- Type fix 1: TypeScript runtime parse diagnostics remain accessed only at the parser boundary through a narrow compatibility type because `SourceFile.parseDiagnostics` is not exposed on the public 5.8 type.
- Type fix 2: `createSecretScanner` preserves its narrower `Promise<Finding[]>` return type while remaining assignable to the coordinator's compatible scanner union.
- CI #152: all 141 tests, strict typecheck, CLI build/runtime smoke, and production build passed.
- Security review removed the insecure-cookie candidate from this slice because `res`/`response` names alone are insufficient framework evidence.
- CI #164: RED reproduced the fake-HTTPS-binding false positive while the other 140 tests passed.
- The TLS Agent matcher was hardened using static import/require binding recognition only, without module resolution or execution.
- CI #165: the hardened rule tests passed and one stale repository-scanner fixture failed because it omitted the new binding requirement; that fixture was corrected.
- The exact final documentation/hardening head must pass the complete gate before merge.

## Final merge rule

PR #9 must not merge unless its exact final documentation and hardening head passes `npm test`, `npm run typecheck`, `npm run build:cli`, the compiled CLI runtime smoke command, and `npm run build`. Any repository-execution path, unbounded traversal regression, arbitrary source-text leakage, false clean result, framework-name-only false positive, or unjustified source-to-sink vulnerability claim blocks merge.
