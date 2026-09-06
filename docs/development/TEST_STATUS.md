# ScopeForge Test Status

Last reconciled: 2026-09-07 (Asia/Singapore)

## Phase 8A released baseline

PR #55 merged as `8d766f5969427a2e4525f5232b5e28b0f93675bd` after CI #758 passed 312/312 test files, 1,348/1,348 tests, typecheck, CLI build/version, historical benchmark, and production Next.js build.

The committed `scopeforge-offline-v1@1.0.0` corpus remains:

- 32 reviewed cases: 16 vulnerable / 16 clean
- TP 16 / FN 0 / FP 0 / TN 16
- error 0 / unsupported 0 / contract mismatch 0
- content hash `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`

Covered-corpus precision/recall/F1 are 1.00 and FPR is 0.00. These are not global ScopeForge accuracy metrics.

## Phase 8B release identity

- PR: #56
- final PR head: `e09710560d2451039b493e4c777dcddf1e62a1cd`
- final executable tree: `50f17f44e770f1179ed2b40b7713e14e864958c0`
- CI-validated PR merge ref: `5636fdfea10534dea1a4e126113ba659168e208a`
- squash merge on `main`: `226a20739871c15d0262d1779b3b013520f47fc6`

## Preflight acceptance

The accepted executable tree passed:

- focused Phase 8 suite: 19/19 files, 97/97 tests
- full repository suite: 318/318 files, 1,379/1,379 tests
- typecheck
- CLI build/version
- historical benchmark
- complete three-profile matrix
- `npm audit --audit-level=info`: 0 vulnerabilities
- production Next.js build with 9/9 static pages
- base-to-head scope/security review with no dashboard/V5, Supabase migration, runtime-worker/repository-authority, lockfile, dependency, or historical-medium-benchmark drift

## Final PR CI #760

GitHub Actions CI #760 ran on Ubuntu 24.04.4 / Node 22.23.2 against PR merge ref `5636fdfea10534dea1a4e126113ba659168e208a` and passed:

- 318/318 test files
- 1,379/1,379 tests
- typecheck
- CLI build/version (`ScopeForge 0.1.0`)
- historical benchmark: 700 files, 0 findings/errors, 766 ms wall
- complete Phase 8B matrix
- production build with 9/9 static pages

Matrix medians in #760:

- dependency: 2,806 ms wall
- IaC: 482 ms wall
- source/AST: 1,322 ms wall

Draft synchronize CI #759 was skipped as intended.

## Post-merge main CI #761

GitHub Actions CI #761 ran on exact main merge SHA `226a20739871c15d0262d1779b3b013520f47fc6` on Ubuntu 24.04.4 / Node 22.23.2 and passed every workflow step:

- 318/318 test files
- 1,379/1,379 tests
- typecheck
- CLI build/version (`ScopeForge 0.1.0`)
- historical `scanner-medium-v1`: 700 files, 0 findings, 0 errors, 597 ms scanner duration, 644 ms wall, RSS delta 27,738,112 B, 20,000 ms ceiling
- Phase 8B matrix
- production Next.js build with 9/9 static pages

### Main CI matrix evidence

`dependency-lockfile-heavy-v1`

- run 1: scanner 2,426 ms / wall 2,428 ms / RSS delta 1,241,088 B
- run 2: scanner 2,391 ms / wall 2,392 ms / RSS delta 4,124,672 B
- run 3: scanner 2,350 ms / wall 2,351 ms / RSS delta 3,100,672 B
- summary: min 2,351 / median wall 2,392 / max 2,428 ms; median scanner 2,391 ms
- correctness: 3 files, 0 findings/errors every run; preflight exactly 5,000 components; OSV disabled

`iac-heavy-v1`

- run 1: scanner 549 ms / wall 588 ms / RSS delta 48,025,600 B
- run 2: scanner 387 ms / wall 426 ms / RSS delta 524,288 B
- run 3: scanner 368 ms / wall 400 ms / RSS delta 409,600 B
- summary: min 400 / median wall 426 / max 588 ms; median scanner 387 ms
- correctness: 601 files, exact four expected findings, 0 errors every run

`source-ast-heavy-v1`

- run 1: scanner 1,234 ms / wall 1,287 ms / RSS delta 786,432 B
- run 2: scanner 978 ms / wall 1,020 ms / RSS delta 131,072 B
- run 3: scanner 979 ms / wall 1,034 ms / RSS delta 131,072 B
- summary: min 1,020 / median wall 1,034 / max 1,287 ms; median scanner 979 ms
- correctness: 1,201 files, exact dynamic-code x4, 0 errors every run

RSS delta remains observational only. The 20,000/30,000 ms limits are catastrophic regression guards, not product latency SLOs.

## Production verification

Exact feature merge deployment:

`dpl_EQUz8d1CUjszH4e2Bh8qu1VDrHCu`

State: READY. `aliasError=null`. Production aliases include `scopeforge.dev`.

## Production capability statement

Phase 8A/8B validation success is not permission to enable repository acquisition, hosted repository scanning, passive runtime workers, or active CORS workers. Those capabilities remain separately gated.
