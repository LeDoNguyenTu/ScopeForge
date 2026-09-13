# Main Runtime Tooling Backport Working State

Last updated: 2026-09-13 (Asia/Singapore)

## Purpose

PR #88 backports already-validated runtime/tooling maintenance onto current `main` while issue #79's remaining authenticated production-browser negative canaries are intentionally postponed.

- branch: `chore/main-runtime-tooling-alignment`
- PR: #88 - `Align main runtime and tooling baseline`
- base branch: `main`
- plan: `docs/superpowers/plans/2026-09-13-main-runtime-tooling-backport.md`

## Release isolation

This work is limited to repository/tooling configuration, architecture regression tests, and documentation. It does not change:

- application authorization or product behavior
- Supabase migrations or production data
- GitHub App provider settings/secrets
- Vercel production environment variables
- hosted worker/runtime gates
- PR #76 or PR #77 operational acceptance requirements

## Task 1 - Node 24 alignment

RED evidence:

- CI #1020
- runner used Node 22.23.2
- audit remained 0 vulnerabilities
- all 393 pre-existing test files / 1,740 pre-existing tests passed
- only the new Node runtime-alignment guard failed because root `engines.node` and CI Node 24 were absent

GREEN implementation:

- root engine contract: `>=24 <25`
- CI setup-node: Node 24
- architecture guard: `tests/architecture/node-runtime-alignment.test.ts`

GREEN evidence:

- CI #1022: SUCCESS
- full test/typecheck/CommonJS CLI/benchmark/Next/browser pipeline passed under Node 24

## Task 2 - GitHub Actions artifact runtime

RED evidence:

- CI #1023
- Node 24 and all 1,741 pre-existing tests remained green
- only `tests/architecture/ci-artifact-action-runtime.test.ts` failed
- workflow log independently emitted the Node 20 deprecation warning for `actions/upload-artifact@v4`

GREEN implementation:

- visual-acceptance uploader changed from `actions/upload-artifact@v4` to `@v7`
- permanent architecture guard requires v7 and rejects v4

GREEN evidence:

- CI #1024: SUCCESS
- full pipeline passed and artifact upload completed through v7

## Task 3 - Vitest config module format

RED commit:

`f917feb4c43ee059375fcbc6dcf35b47891496fe`

RED evidence:

- CI #1025 / run `34744118561`: expected FAILURE
- Node `v24.20.0`, npm `11.19.0`, audit 0
- 1,742 pre-existing tests passed
- only the new `vitest-config-module-format` guard failed
- log reproduced the prior warning: ESM syntax in `vitest.config.ts` loaded as CommonJS

GREEN implementation:

- replaced `vitest.config.ts` with `vitest.config.mts`
- uses `fileURLToPath(new URL(".", import.meta.url))`
- root package remains CommonJS; no package-level `"type": "module"`
- CLI contract remains CommonJS
- architecture guard: `tests/architecture/vitest-config-module-format.test.ts`

Authoritative executable GREEN head:

`b987fd9db36173b0a338cce7796ac599ae46e163`

Exact synthetic merge validated by CI:

`ecc0cd2f77616086d49588c6e69336f8b3dfeed5`

GREEN evidence:

- CI #1026 / run `34744282931`: SUCCESS
- Node `v24.20.0`
- npm `11.19.0`
- audit: 0 vulnerabilities
- tests: 396/396 files, 1,743/1,743 tests
- old Vitest CommonJS/ESM warning: absent
- typecheck: PASS
- CLI build/version: PASS, `ScopeForge 0.1.0`
- scanner benchmark: PASS, 700 files, 0 findings, 0 errors, 822 ms wall time against 20 s ceiling
- deterministic benchmark matrix: PASS
- optimized Next.js build: PASS
- strict-CSP responsive browser acceptance: PASS
- production UI/Turnstile diagnostic: PASS
- `actions/upload-artifact@v7`: PASS
- artifact: `10313449144`, 15 files, 3,443,883 bytes

## Documentation reconciliation

After the executable GREEN candidate, documentation-only `[skip ci]` commits refresh:

- `README.md` - Node 24 requirement, released Security Packs v1, current hosted/control-plane state
- `docs/development/SESSION_HANDOFF.md` - Phase 10A1/#79/#76/#77/PR #87/current maintenance resume state
- `docs/development/UNFINISHED_WORK.md` - replaces the obsolete claim that Phase 10 did not exist with the actual gated release queue

These commits do not change executable behavior. CI #1026 remains the authoritative executable-tree evidence until another executable/config/test change occurs.

## Deferred browser-only work

Issue #79 remains open. Resume later with a supported authenticated browser/session surface to prove:

1. a different valid numeric GitHub installation ID is rejected during the owner/admin callback flow
2. a normal workspace member/viewer cannot initiate or complete Connect GitHub

Regression tests already cover those authorization properties, but they are not a substitute for live production canaries.

## Final integration checklist

- [x] Node 24 RED -> GREEN evidence captured
- [x] `upload-artifact@v7` RED -> GREEN evidence captured
- [x] Vitest `.mts` RED -> GREEN evidence captured
- [x] audit 0 and full exact executable candidate CI green
- [x] CommonJS CLI preserved
- [x] browser/CSP/responsive acceptance green
- [x] stale public/handoff/unfinished-work documentation reconciled
- [ ] final PR diff/review confirms isolation
- [ ] merge PR #88
- [ ] verify post-merge `main` CI before recording release completion

Do not call PR #88 released until the final review, merge, and post-merge main verification are complete.
