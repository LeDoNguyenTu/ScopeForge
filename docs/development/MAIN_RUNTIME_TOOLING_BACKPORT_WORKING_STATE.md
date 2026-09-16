# Main Runtime Tooling Backport Working State

Last updated: 2026-09-13 (Asia/Singapore)

## Status

PR #88 (`Align main runtime and tooling baseline`) is released.

- branch used: `chore/main-runtime-tooling-alignment`
- squash merge to main: `e12bbbe51515fc3d738428737ecd6281f2a2a3c8`
- production deployment: `dpl_6ZcxVWhvudce8AzaQGxg3ufzmwx7` - READY
- plan: `docs/superpowers/plans/2026-09-13-main-runtime-tooling-backport.md`

This work remained isolated from Phase 10A2/10A3. It did not change application authorization/product behavior, Supabase migrations/data, GitHub App provider settings/secrets, Vercel environment variables, hosted runtime flags, or #76/#77 operational acceptance requirements.

## Task 1 - Node 24 alignment

RED evidence:

- CI #1020
- runner used Node 22.23.2
- audit remained 0 vulnerabilities
- all 393 pre-existing test files / 1,740 pre-existing tests passed
- only the new Node runtime-alignment guard failed

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
- all 1,741 pre-existing tests remained green
- only the new artifact-action guard failed
- `actions/upload-artifact@v4` emitted the hosted Node 20 deprecation warning

GREEN implementation:

- visual-acceptance uploader changed to `actions/upload-artifact@v7`
- permanent architecture guard requires v7 and rejects v4

GREEN evidence:

- CI #1024: SUCCESS

## Task 3 - Vitest config module format

RED commit:

`f917feb4c43ee059375fcbc6dcf35b47891496fe`

RED evidence:

- CI #1025 / run `34744118561`: expected FAILURE
- Node `v24.20.0`, npm `11.19.0`, audit 0
- 1,742 pre-existing tests passed
- only the new module-format guard failed
- old CommonJS-loaded ESM warning reproduced

GREEN implementation:

- `vitest.config.ts` replaced by `vitest.config.mts`
- `fileURLToPath(new URL(".", import.meta.url))`
- no package-level `"type": "module"`
- CommonJS CLI preserved
- architecture guard: `tests/architecture/vitest-config-module-format.test.ts`

Authoritative candidate before merge:

- executable head: `b987fd9db36173b0a338cce7796ac599ae46e163`
- synthetic merge: `ecc0cd2f77616086d49588c6e69336f8b3dfeed5`
- CI #1026 / run `34744282931`: SUCCESS
- Node `v24.20.0`, npm `11.19.0`
- audit 0
- tests 396/396 files, 1,743/1,743 tests
- old Vitest warning absent
- typecheck, CommonJS CLI, scanner benchmark, deterministic matrix, optimized Next build, CSP/responsive browser acceptance, production diagnostic, and `upload-artifact@v7`: PASS
- candidate artifact: `10313449144`

## Final review and release

The complete PR diff was reviewed before merge and contained only:

- CI/runtime metadata
- the three architecture regression guards
- the ESM-local Vitest config rename
- documentation

No Critical or Important review issue was found. There were no unresolved review threads.

Final release evidence:

- squash merge: `e12bbbe51515fc3d738428737ecd6281f2a2a3c8`
- post-merge main CI #1027 / run `34744753785`: SUCCESS
- every workflow stage passed, including audit, tests, typecheck, CommonJS CLI build/version, both benchmark stages, optimized Next build, CSP browser smoke, production UI/Turnstile diagnostic, and artifact upload
- post-merge artifact: `10313589714`, 3,448,428 bytes
- production deployment: `dpl_6ZcxVWhvudce8AzaQGxg3ufzmwx7`, READY, production, exact merge SHA, region `sin1`, `aliasError=null`
- `scopeforge.dev`: HTTP 200 with strict nonce CSP and expected security headers
- exact-deployment error/fatal runtime check: no fresh entries in the checked window

## Deferred browser-only work

Issue #79 remains open. It still requires a supported authenticated browser/session surface for two independent live production canaries:

1. reject a different valid numeric GitHub installation ID in the owner/admin callback flow
2. reject Connect GitHub for a normal workspace member/viewer

Regression tests cover both authorization properties, but they are not live production canary evidence.

## Completed integration checklist

- [x] Node 24 RED -> GREEN evidence captured
- [x] `upload-artifact@v7` RED -> GREEN evidence captured
- [x] Vitest `.mts` RED -> GREEN evidence captured
- [x] audit and exact candidate CI green
- [x] CommonJS CLI preserved
- [x] browser/CSP/responsive acceptance green
- [x] stale public/handoff/unfinished-work documentation reconciled
- [x] final PR diff/review confirmed isolation
- [x] PR #88 merged
- [x] post-merge `main` CI passed
- [x] exact production deployment verified READY and healthy

PR #88 is complete. Resume active release work from `docs/development/CURRENT_STATE.md` and `docs/development/NEXT_STEPS.md`.
