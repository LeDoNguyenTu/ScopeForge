# ScopeForge Session Handoff

## Current phase
Phase 3D - JavaScript/TypeScript structural SAST implemented on PR #9, pending final exact-head documentation CI and merge

## Completed before this PR
- Phase 1 foundation merged.
- Phase 2 Asset Control merged through PR #4.
- Phase 3 scanner design merged through PR #5.
- Phase 3A scanner foundation merged through PR #6 as `44304860926929f8505da5036bec235fe4ce2c37`.
- Phase 3B safe reads, configuration, policy, and CLI merged through PR #7 as `d1ca23c5df0bc4ed2276f37b585db453a30b41c0`.
- Phase 3C secret scanner merged through PR #8 as `ee2b18c37d264fc22e47e650970e66d01f7c92dd`.

## Phase 3D implementation
- isolated branch: `feat/phase-3d-jsts-structural-sast`
- PR: #9 `Build Phase 3D JavaScript and TypeScript structural SAST`
- parser uses the existing TypeScript compiler API through `createSourceFile`
- supported source families: JS, JSX, MJS, CJS, TS, TSX, MTS, CTS
- no TypeScript `Program`, target module resolution, type checker, emit, dynamic import, or repository `require` execution
- AST traversal is iterative and bounded per file
- semantic context is stable across line/comment movement
- scanner coordinator now accepts findings plus structured per-file diagnostics while preserving array-return compatibility for existing scanners
- malformed, binary-like, unreadable, and over-budget JS/TS files fail closed per file without erasing findings from other files
- first structural rules:
  - `jsts/dynamic-code-execution`
  - `jsts/tls-verification-disabled`
  - `jsts/insecure-cookie`
- findings describe observed constructs only and do not claim attacker-controlled source-to-sink flow
- finding evidence uses normalized fixed descriptors, not repository source lines
- `jsts` is registered beside `secrets` in the built-in CLI registry
- built-in rule listing is deterministic and unknown built-in rule IDs fail closed

## TDD and verification evidence
- CI #132: Phase 3D RED checkpoint. 111 tests passed; failures were limited to the missing structured scanner diagnostics, JS/TS modules, CLI registration, and structural output.
- First GREEN implementation made all 141 tests pass on CI #150, then strict typecheck caught two contract issues: hidden TypeScript parse-diagnostic typing and widened secret-scanner return typing.
- Both type issues were corrected at their boundaries without changing detector behavior.
- CI #152 on `41f2e331b829b7914c18de139ed0e04dd0f99b53`: 30 test files and 141 tests passed, strict typecheck passed, `npm run build:cli` passed, compiled CLI version smoke passed, and Next.js production build passed.
- The final documentation head still needs its own exact-head CI before merge.

## Trust boundary
- repository contents remain hostile input
- all JS/TS repository reads use `readInventoryEntry`
- parser diagnostics are generic and do not copy source lines
- fixed AST node budget prevents unbounded structural traversal
- no repository code, imported module, or lifecycle-script execution
- no target dependency installation
- no network behavior in structural SAST
- source-to-sink claims remain deferred to Phase 3E taint analysis
- scanner errors cannot be mistaken for a clean result

## Known limitations
- structural SAST intentionally recognizes only a small high-confidence set of direct constructs
- no data-flow/taint propagation yet
- no whole-program type analysis or module resolution
- TypeScript is currently an existing repository development dependency used at scanner runtime; packaging/publication dependency placement must be reviewed before a standalone npm release
- no SCA/OSV, SBOM, IaC, baseline file, or SARIF yet

## Next action
1. Verify the exact final documentation head of PR #9 through the full CI gate.
2. Confirm no unresolved Critical or Important review blockers.
3. Mark PR #9 ready and squash merge using expected-head protection.
4. Begin Phase 3E limited high-confidence JavaScript/TypeScript taint analysis from updated `main`.

## Resume protocol
Read this file, `CURRENT_STATE.md`, the Phase 3 design, and the active implementation plan before changing scanner behavior. Update this handoff whenever a scanner trust boundary changes.
