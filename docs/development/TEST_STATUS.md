# ScopeForge Test Status

Last reconciled: 2026-09-06 (Asia/Singapore)

## Phase 8A - released baseline

PR #55 merged as `8d766f5969427a2e4525f5232b5e28b0f93675bd` after CI #758 passed 312/312 test files, 1,348/1,348 tests, typecheck, CLI build/version, historical scanner benchmark, and production Next.js build.

The committed `scopeforge-offline-v1@1.0.0` corpus remains:

- 32 reviewed cases
- 16 vulnerable / 16 clean
- TP 16 / FN 0 / FP 0 / TN 16
- error 0 / unsupported 0 / contract mismatch 0
- content hash `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`

Covered-corpus precision/recall/F1 are 1.00 and FPR is 0.00, but these are not global ScopeForge accuracy metrics.

## Phase 8B TDD checkpoints

Task 1 shared harness:

- RED witnessed after correcting the plan's `.test.mjs` mismatch to the repository's `.test.ts` Vitest include pattern
- GREEN: 20/20 harness tests
- harness enforces exact files/findings/errors, three runs/profile, deterministic rule-count normalization, valid timing/RSS values, catastrophic wall ceilings, and cleanup

Task 2 `source-ast-heavy-v1`:

- deterministic 1,201-file JSTS-only fixture
- exact expected findings: `jsts/dynamic-code-execution` x4
- real compiled three-run probe passed with 0 errors

Task 3 `dependency-lockfile-heavy-v1`:

- deterministic three-file SCA-only fixture
- OSV explicitly disabled
- compiled preflight requires exactly 5,000 resolved `package-lock.json` components with zero parser diagnostics
- real compiled three-run probe passed with 0 findings/errors

Task 4 `iac-heavy-v1`:

- deterministic 601-file IaC-only fixture
- exact findings: one each for Docker floating base image, GitHub Actions write-all, Kubernetes privileged container, and Terraform public RDS
- real compiled three-run probe passed with 0 errors

Task 5 matrix runner:

- `benchmark:matrix` package script added without dependency/lockfile changes
- benchmark suite: 5 files / 30 tests passed before CI integration
- typecheck passed after test-only ESM import typing was aligned
- CLI build passed
- complete three-profile matrix passed

Task 6 CI admission:

- exact admission head: `c28f4ef150b06adbce26c5836e1e47d00788c670`
- workflow-order test witnessed RED with matrix step absent
- permanent workflow step added immediately after `npm run benchmark:scanner`
- GREEN after workflow change: 6 benchmark files / 31 tests, typecheck, CLI build, full matrix

## Exact Phase 8B admission measurement

Outer process on `c28f4ef150b06adbce26c5836e1e47d00788c670`:

- wall time: 15.561 s
- sampled peak benchmark child RSS: 61,712 KiB
- CI admission threshold: <=30 s
- decision: accepted into permanent CI

Exact matrix output from that measurement:

### `dependency-lockfile-heavy-v1`

- run 1: scanner 2,486 ms / wall 2,498 ms / RSS delta 856,064 B
- run 2: scanner 2,451 ms / wall 2,452 ms / RSS delta 2,551,808 B
- run 3: scanner 2,296 ms / wall 2,297 ms / RSS delta 3,870,720 B
- summary: min 2,297 / median 2,452 / max 2,498 ms wall; median scanner 2,451 ms
- correctness: 3 files, 0 findings, 0 errors on every run; preflight exactly 5,000 components

### `iac-heavy-v1`

- run 1: scanner 540 ms / wall 566 ms / RSS delta 30,253,056 B
- run 2: scanner 361 ms / wall 385 ms / RSS delta 1,421,312 B
- run 3: scanner 342 ms / wall 362 ms / RSS delta 532,480 B
- summary: min 362 / median 385 / max 566 ms wall; median scanner 361 ms
- correctness: 601 files, exactly 4 expected findings, 0 errors on every run

### `source-ast-heavy-v1`

- run 1: scanner 1,395 ms / wall 1,419 ms / RSS delta 782,336 B
- run 2: scanner 1,213 ms / wall 1,237 ms / RSS delta 540,672 B
- run 3: scanner 1,201 ms / wall 1,224 ms / RSS delta 0 B
- summary: min 1,224 / median 1,237 / max 1,419 ms wall; median scanner 1,213 ms
- correctness: 1,201 files, exactly 4 dynamic-code findings, 0 errors on every run

RSS delta is an observational memory signal and is not a memory ceiling. The per-profile wall ceilings are catastrophic regression guards, not product latency SLOs.

## Current release status

Phase 8B has not yet had its final full repository preflight or final GitHub Actions release gate. No intermediate RED/GREEN commit consumed the substantive Actions gate because commits used `[skip ci]`.

Final release still requires full tests, typecheck, CLI build/version, historical benchmark, matrix, npm audit, production build, base-to-head review, Vercel Preview READY, one exact-head Actions gate, merge, and production verification.

## Production capability statement

Phase 8 validation evidence is not permission to enable repository acquisition, hosted repository scanning, passive runtime workers, or active CORS workers. Those remain separately gated.
