# ScopeForge Phase 8 Working State

Last reconciled: 2026-09-06 (Asia/Singapore)

This is the authoritative resumable non-UI Phase 8 state. Dashboard V5/UI remains a separate workstream and must not be modified from here.

## Phase 8A - complete and merged

- PR #55 merged
- squash merge: `8d766f5969427a2e4525f5232b5e28b0f93675bd`
- final CI: #758 success
- production deployment for the merge: `dpl_BSfMBBxjgmFZHWmzAy5RN5N6Jvyj`, READY on `scopeforge.dev`
- approved Phase 8 design: `docs/superpowers/specs/2026-09-05-phase-8-validation-accuracy-design.md`
- authoritative Phase 8A plan: `docs/superpowers/plans/2026-09-05-phase-8a-accuracy-foundation-v2.md`

Committed accuracy baseline:

- `scopeforge-offline-v1@1.0.0`
- content hash `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`
- 32 reviewed cases / 8 rules / 3 scanner families
- TP 16 / FN 0 / FP 0 / TN 16
- errors 0 / unsupported 0 / contract mismatches 0

These values describe only the committed covered corpus and are not global or real-world ScopeForge accuracy.

Do not recreate Phase 8A Tasks 1-8.

## Phase 8B - implementation complete, release gates active

Branch: `feat/phase-8b-performance-matrix-v1`.

Design: `docs/superpowers/specs/2026-09-06-phase-8b-performance-matrix-design.md`.

Plan: `docs/superpowers/plans/2026-09-06-phase-8b-performance-matrix.md`.

Workflow-integrated performance evidence head: `c28f4ef150b06adbce26c5836e1e47d00788c670`.

### Implemented profiles

`dependency-lockfile-heavy-v1`

- three fixture files
- SCA only
- OSV explicitly disabled
- compiled preflight requires exactly 5,000 resolved components from `package-lock.json`
- expected scan result: 3 files, zero findings/errors
- catastrophic ceiling: 20,000 ms/run

`iac-heavy-v1`

- 601 files
- IaC only
- 150 Dockerfiles, 150 Kubernetes manifests, 150 Terraform files, 150 GitHub Actions workflows, plus config
- exact sentinels: Docker floating base image x1, Actions write-all x1, Kubernetes privileged container x1, Terraform public RDS x1
- expected: exactly four findings / zero errors
- catastrophic ceiling: 30,000 ms/run

`source-ast-heavy-v1`

- 1,201 files
- JSTS only
- 600 TS + 600 JS generated dense-source files plus config
- expected: `jsts/dynamic-code-execution` x4 / zero errors
- catastrophic ceiling: 30,000 ms/run

Every profile runs exactly three times. Measurements include scanner duration, outer wall time, and RSS delta. RSS delta is not a memory limit. Catastrophic ceilings are regression guards, not product SLOs.

### Exact CI-admission evidence on `c28f4ef...`

Outer matrix command:

- wall: 15.561 s
- sampled peak child RSS: 61,712 KiB
- admission threshold: <=30 s
- decision: permanent CI integration accepted

Per-profile median wall:

- dependency: 2,452 ms
- IaC: 385 ms
- source/AST: 1,237 ms

Every timed run satisfied its exact files/findings/errors contract.

`.github/workflows/ci.yml` now runs:

1. `npm run benchmark:scanner`
2. `npm run benchmark:matrix`
3. production build

A workflow-order regression test was witnessed RED before adding the matrix step.

### Current GREEN evidence

On `c28f4ef...` after CI integration:

- `npx vitest run tests/benchmarks`: 6 files / 31 tests PASS
- `npm run typecheck`: PASS
- `npm run build:cli`: PASS
- `npm run benchmark:matrix`: PASS

Earlier real probes independently established the 5,000-component SCA preflight and exact source/IaC finding contracts.

Intermediate commits use `[skip ci]`; no substantive final GitHub Actions gate has been consumed yet.

## Remaining Phase 8B release sequence

1. finish this documentation checkpoint
2. docs-sensitive benchmark/validation/architecture verification
3. freeze exact candidate SHA/tree
4. full disposable Linux preflight:
   - `npm ci --ignore-scripts --no-audit --no-fund`
   - focused Phase 8 suites
   - `npm test`
   - typecheck
   - CLI build/version
   - historical benchmark
   - matrix
   - npm audit
   - `NODE_ENV=production npm run build`
5. base-to-head review for UI/Supabase/runtime/dependency/hygiene drift
6. open one draft Phase 8B PR
7. require exact-head Vercel Preview READY
8. create one tree-identical final verification commit and mark PR ready
9. one substantive Actions validation run must pass, including `benchmark:matrix`
10. squash merge with expected-head protection
11. verify production Vercel READY on the exact merge SHA
12. one post-merge docs-only `[skip ci]` reconciliation on `main`

## Authority boundary

Phase 8B is local/offline measurement infrastructure. It adds no:

- Supabase access or migration
- hosted scanning authority
- repository acquisition authority
- runtime network authority
- worker/supervisor/control authority
- browser/dashboard UI authority
- executable plugin authority
- enabled OSV networking

Production worker capability flags remain false/absent and separately gated.

## Runtime gates

Keep false/absent unless separate operational acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Phase 8C - next after verified Phase 8B merge

Produce reproducible technical publication from normalized Phase 8A/8B evidence with exact provenance, raw counts, benchmark runs/summaries, limitations, and explicit scope.

## UI isolation

PR #49 and all active dashboard V5/UI branches remain separate. Do not edit, merge, replace, retarget, or deploy them from Phase 8.

## Branch cleanup

Delete merged backend branches only through a genuine remote delete-ref operation. The connected GitHub tool surface currently lacks that mutation, so leave merged refs intact rather than force-moving them.
