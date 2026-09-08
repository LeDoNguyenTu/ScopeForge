# ScopeForge Phase 8B Release State

Last reconciled: 2026-09-07 (Asia/Singapore)

This document is the authoritative release record for the non-UI Phase 8B scanner performance matrix.

## Integration identity

- repository: `LeDoNguyenTu/ScopeForge`
- PR: #56, `Phase 8B scanner performance matrix`
- base at final integration: `bf6a805030295875e5e124f5e17d2e3d79a2e6da`
- final PR head: `e09710560d2451039b493e4c777dcddf1e62a1cd`
- accepted executable tree: `50f17f44e770f1179ed2b40b7713e14e864958c0`
- CI-validated PR merge ref: `5636fdfea10534dea1a4e126113ba659168e208a`
- squash merge on `main`: `226a20739871c15d0262d1779b3b013520f47fc6`
- source branch: `feat/phase-8b-performance-matrix-v1`

The final PR head was a tree-identical verification commit over the preflighted executable tree. The squash merge on `main` retained that exact tree.

## Delivered performance profiles

### `dependency-lockfile-heavy-v1`

- SCA only
- OSV explicitly disabled
- 3 analyzed files
- compiled preflight requires exactly 5,000 resolved `package-lock.json` components and zero parser diagnostics
- timed scan requires 0 findings and 0 errors
- catastrophic ceiling: 20,000 ms/run

### `iac-heavy-v1`

- 601 analyzed files
- IaC only
- exact findings per run:
  - `iac/docker-floating-base-image` x1
  - `iac/github-actions-write-all-permissions` x1
  - `iac/kubernetes-privileged-container` x1
  - `iac/terraform-aws-public-rds` x1
- 0 errors
- catastrophic ceiling: 30,000 ms/run

### `source-ast-heavy-v1`

- 1,201 analyzed files
- JSTS only
- exact `jsts/dynamic-code-execution` x4 per run
- 0 errors
- catastrophic ceiling: 30,000 ms/run

Each profile runs exactly three times. The shared harness verifies exact files/findings/errors before accepting timing. It records scanner duration, outer wall time, and RSS delta. RSS delta is observational only and is not peak-memory or a memory-limit claim. Catastrophic ceilings are regression guards, not product SLOs.

## Permanent CI admission

Workflow-integrated measurement on `c28f4ef150b06adbce26c5836e1e47d00788c670`:

- total matrix outer wall: 15.561 s
- sampled peak benchmark child RSS: 61,712 KiB
- admission threshold: <=30 s
- decision: accepted into permanent CI

The workflow-order regression test was witnessed RED before `.github/workflows/ci.yml` changed. The canonical CI sequence now runs `npm run benchmark:matrix` immediately after `npm run benchmark:scanner`.

## Frozen-tree preflight

The accepted executable tree passed:

- focused Phase 8 suite: 19/19 files, 97/97 tests
- full repository suite: 318/318 files, 1,379/1,379 tests
- typecheck
- CLI build/version (`ScopeForge 0.1.0`)
- historical `scanner-medium-v1`
- complete Phase 8B matrix
- `npm audit --audit-level=info`: 0 vulnerabilities
- production Next.js build with 9/9 static pages

Base-to-head scope/security review found exactly 20 changed files and confirmed:

- no dashboard/V5/UI paths
- no Supabase migrations
- no production worker/runtime/repository-acquisition authority changes
- no `package-lock.json` change or dependency addition
- `benchmarks/scanner-medium-fixture.mjs` unchanged
- `benchmarks/scanner-medium.mjs` unchanged
- no trailing-whitespace additions or conflict markers
- new benchmark modules add no network/process/browser authority
- `eval` / `new Function` occur only as strings written into generated JSTS target fixtures and are never executed by the benchmark harness

## Final PR CI #760

GitHub Actions run #760 passed on Ubuntu 24.04.4 / Node 22.23.2 against merge ref `5636fdfea10534dea1a4e126113ba659168e208a`:

- 318/318 test files
- 1,379/1,379 tests
- typecheck
- CLI build/version
- historical benchmark: 700 files, 0 findings/errors, 766 ms wall
- complete matrix
- production Next.js build with 9/9 static pages

Matrix median walls in #760:

- dependency: 2,806 ms
- IaC: 482 ms
- source/AST: 1,322 ms

Draft synchronize CI #759 was skipped, so only the intended substantive final PR gate ran.

## Post-merge main CI #761

GitHub Actions run #761 passed every workflow step on exact main SHA `226a20739871c15d0262d1779b3b013520f47fc6`, Ubuntu 24.04.4 / Node 22.23.2:

- 318/318 test files
- 1,379/1,379 tests
- typecheck
- CLI build/version (`ScopeForge 0.1.0`)
- historical benchmark: 700 files, 0 findings, 0 errors, 597 ms scanner duration, 644 ms wall, RSS delta 27,738,112 B
- complete matrix
- production Next.js build with 9/9 static pages

Main CI matrix summaries:

- dependency: wall min 2,351 / median 2,392 / max 2,428 ms; median scanner 2,391 ms; max RSS delta 4,124,672 B
- IaC: wall min 400 / median 426 / max 588 ms; median scanner 387 ms; max RSS delta 48,025,600 B
- source/AST: wall min 1,020 / median 1,034 / max 1,287 ms; median scanner 979 ms; max RSS delta 786,432 B

Every run satisfied its exact correctness contract.

## Vercel acceptance

Final-head preview:

- deployment: `dpl_FLKJDPdiSGmWA11MbvHdnP3Zqtng`
- head: `e09710560d2451039b493e4c777dcddf1e62a1cd`
- state: READY
- `aliasError=null`

Exact feature merge production deployment:

- deployment: `dpl_EQUz8d1CUjszH4e2Bh8qu1VDrHCu`
- commit: `226a20739871c15d0262d1779b3b013520f47fc6`
- target: production
- state: READY
- `aliasError=null`
- aliases include `scopeforge.dev`

## Authority and production capability verdict

Phase 8B is local/offline measurement infrastructure. It introduced no Supabase mutation, hosted scanner activation, repository acquisition authority, worker/runtime network authority, browser/dashboard authority, or executable plugin authority.

These capability flags remain false/absent until separately accepted operationally:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 8B release acceptance does not authorize changing them.

## Next boundary - Phase 8C

Phase 8C should build deterministic reproducible technical publication from normalized Phase 8A/8B evidence. It must include exact provenance, covered-corpus raw counts and valid metrics, all benchmark runs/summaries, limitations, unsupported cases, and explicit scope.

The 32-case Phase 8A corpus must not be presented as global or real-world accuracy, and Phase 8B catastrophic ceilings must not be presented as product latency SLOs.

Ordinary publication should remain local/offline and must not gain new hosted/network/runtime authority merely to generate reports.

## Branch cleanup

The Phase 8B source branch is merged but cannot be deleted through the currently connected GitHub write surface because no genuine delete-ref/branch-delete action is exposed. Leave it intact rather than force-moving it. Preserve PR #49 and all active dashboard V5/UI branches.
