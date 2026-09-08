# ScopeForge Phase 8 Working State

Last reconciled: 2026-09-07 (Asia/Singapore)

This is the authoritative resumable non-UI Phase 8 state. Dashboard V5/UI remains a separate workstream and must not be modified from here.

## Phase 8A - complete and merged

- PR #55 merged as `8d766f5969427a2e4525f5232b5e28b0f93675bd`
- final CI #758: success
- production deployment: `dpl_BSfMBBxjgmFZHWmzAy5RN5N6Jvyj`, READY on `scopeforge.dev`
- corpus: `scopeforge-offline-v1@1.0.0`
- content hash: `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`
- 32 reviewed cases / 8 rules / 3 scanner families
- TP 16 / FN 0 / FP 0 / TN 16
- error 0 / unsupported 0 / contract mismatch 0

The covered-corpus metrics are not global or real-world ScopeForge accuracy.

Do not recreate Phase 8A Tasks 1-8.

## Phase 8B - complete, merged, and production-verified

Design: `docs/superpowers/specs/2026-09-06-phase-8b-performance-matrix-design.md`.

Plan: `docs/superpowers/plans/2026-09-06-phase-8b-performance-matrix.md`.

Release state: `docs/development/PHASE_8B_RELEASE_STATE.md`.

Integration identity:

- PR: #56
- base at integration: `bf6a805030295875e5e124f5e17d2e3d79a2e6da`
- final PR head: `e09710560d2451039b493e4c777dcddf1e62a1cd`
- executable tree: `50f17f44e770f1179ed2b40b7713e14e864958c0`
- CI-validated PR merge ref: `5636fdfea10534dea1a4e126113ba659168e208a`
- squash merge on `main`: `226a20739871c15d0262d1779b3b013520f47fc6`

### Implemented profiles

`dependency-lockfile-heavy-v1`

- SCA only
- OSV explicitly disabled
- 3 analyzed files
- preflight exactly 5,000 resolved `package-lock.json` components
- 0 findings / 0 errors expected
- 20,000 ms catastrophic ceiling

`iac-heavy-v1`

- 601 analyzed files
- exact findings: Docker floating base x1, GitHub Actions write-all x1, Kubernetes privileged x1, Terraform public RDS x1
- 0 errors
- 30,000 ms catastrophic ceiling

`source-ast-heavy-v1`

- 1,201 analyzed files
- JSTS only
- exact `jsts/dynamic-code-execution` x4
- 0 errors
- 30,000 ms catastrophic ceiling

Every profile runs exactly three times. The harness enforces correctness before accepting timing. RSS delta is observational only. Catastrophic ceilings are regression guards, not product SLOs.

### CI admission

Workflow-integrated matrix measurement was 15.561 s outer wall against a <=30 s admission rule, so permanent CI integration was accepted. A workflow-order test was witnessed RED before the matrix step was added.

CI order now includes:

1. historical `npm run benchmark:scanner`
2. `npm run benchmark:matrix`
3. production build

### Release verification

Preflight on the accepted tree passed:

- focused Phase 8 suite: 19 files / 97 tests
- full repository suite: 318 files / 1,379 tests
- typecheck
- CLI build/version
- historical benchmark
- complete matrix
- npm audit: 0 vulnerabilities
- production Next.js build with 9/9 static pages
- complete base-to-head scope/security review

Final PR CI #760 passed on merge ref `5636fdfea10534dea1a4e126113ba659168e208a`.

Post-merge main CI #761 passed on `226a20739871c15d0262d1779b3b013520f47fc6`:

- 318/318 files and 1,379/1,379 tests
- typecheck and CLI build/version
- historical benchmark: 700 files, 0 findings/errors, 644 ms wall
- matrix median walls: dependency 2,392 ms; IaC 426 ms; source/AST 1,034 ms
- production build with 9/9 static pages

Production deployment `dpl_EQUz8d1CUjszH4e2Bh8qu1VDrHCu` is READY with `aliasError=null` and aliases include `scopeforge.dev`.

### Scope and authority result

The Phase 8B release changed exactly 20 files from its base and introduced no:

- dashboard/V5/UI path changes
- Supabase migrations
- production worker/runtime/repository-acquisition authority
- dependency additions or `package-lock.json` changes
- changes to historical `scanner-medium-v1` fixture/runner

The generated JSTS fixtures contain `eval` / `new Function` text only as detector target strings; the benchmark harness never executes them.

## Runtime gates

Keep false/absent unless separate operational acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Phase 8C - current resume action

Begin reproducible technical publication from the merged Phase 8A/8B evidence.

First implementation actions:

1. audit existing report/validation modules and methodology to avoid duplicate surfaces
2. write a Phase 8C design/spec that keeps reporting local/offline and deterministic
3. define a versioned normalized publication contract containing exact provenance, covered-corpus counts/metrics, all benchmark runs/summaries, limitations, and unsupported cases
4. add machine-readable and human-readable deterministic outputs with privacy tests
5. use TDD and preflight-first verification before CI

No publication output may describe the 32-case corpus as global accuracy or invent an SLO from benchmark ceilings.

## UI isolation

PR #49 and all active dashboard V5/UI branches remain separate. Do not edit, merge, replace, retarget, or deploy them from Phase 8.

## Branch cleanup

The merged Phase 8B branch may be deleted only using a genuine remote delete-ref operation. The connected GitHub tool surface currently lacks that mutation, so leave the branch intact rather than force-moving it.
