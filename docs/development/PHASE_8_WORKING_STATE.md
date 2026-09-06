# ScopeForge Phase 8 Working State

Last reconciled: 2026-09-06 (Asia/Singapore)

This is the authoritative resumable state for the non-UI Phase 8 validation workstream. Dashboard V5/UI remains a separate active branch/workstream and must not be modified from here.

## Phase 8A status - complete and merged

- repository: `LeDoNguyenTu/ScopeForge`
- merged PR: #55, `Phase 8A offline accuracy foundation`
- base validated during integration: `222d9591dbd5e357d179eb06407b0787a2efef7f`
- final accepted PR head: `9b1fd4a26924f8fff21ce5f9614b8fc4e0e20510`
- final head tree: `aa6d94c2a35973ee2c8ccbc038d22d7de4f48cc8`
- CI-validated PR merge ref: `479cffade6143852dfd9dabbd344271d729f6ba3`
- squash merge on `main`: `8d766f5969427a2e4525f5232b5e28b0f93675bd`
- final CI: #758, success
- production deployment for the merge: `dpl_BSfMBBxjgmFZHWmzAy5RN5N6Jvyj`, READY on `scopeforge.dev`
- approved design: `docs/superpowers/specs/2026-09-05-phase-8-validation-accuracy-design.md`
- authoritative Phase 8A plan: `docs/superpowers/plans/2026-09-05-phase-8a-accuracy-foundation-v2.md`

Do not recreate Phase 8A Tasks 1-8.

## Phase 8A authority boundary

Phase 8A is local/offline validation infrastructure only. It does not add:

- Supabase access or migrations
- hosted scanner activation
- repository acquisition authority
- runtime network authority
- worker/supervisor/control authority
- browser/dashboard UI
- executable plugins
- SCA/OSV network-backed accuracy measurement

Production worker capability flags remain disabled and separately gated.

Permanent guards reject hosted/runtime/network/dynamic-execution authority in `packages/validation-accuracy`. The complete committed ground-truth corpus is hashed before/after evaluation/reporting, and report output is privacy-reduced.

## `scopeforge-offline-v1@1.0.0`

Corpus content hash:

`3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`

Coverage:

- 32 cases
- 16 vulnerable / 16 clean
- 8 represented rules
- scanner families: `iac`, `jsts`, `secrets`
- 97 corpus files

Raw covered-corpus result:

- TP: 16
- FN: 0
- FP: 0
- TN: 16
- error: 0
- unsupported: 0
- contract mismatch: 0

Derived covered-corpus metrics:

- precision: 1.00
- recall: 1.00
- false-positive rate: 0.00
- F1: 1.00

Each represented rule has TP=2, FN=0, FP=0, TN=2 in this corpus.

**These values describe only the committed 32-case reviewed corpus and are not global or real-world ScopeForge accuracy.**

Represented rules:

- `iac/config-npm-strict-ssl-disabled`
- `iac/docker-floating-base-image`
- `iac/github-actions-write-all-permissions`
- `iac/kubernetes-privileged-container`
- `iac/terraform-aws-public-rds`
- `jsts/command-injection`
- `jsts/dynamic-code-execution`
- `secrets/github-token`

## Phase 8A final acceptance

GitHub Actions CI #758 checked out PR merge ref `479cffade6143852dfd9dabbd344271d729f6ba3`, which combined exact accepted head `9b1fd4a26924f8fff21ce5f9614b8fc4e0e20510` with exact base `222d9591dbd5e357d179eb06407b0787a2efef7f`.

Environment and result:

- Ubuntu 24.04.4
- Node 22.23.2
- 312/312 test files passed
- 1,348/1,348 tests passed
- typecheck passed
- CLI build/version passed (`ScopeForge 0.1.0`)
- scanner-medium-v1: 700 files, 0 findings, 0 errors, 853 ms scanner duration, 910 ms wall time / 20,000 ms ceiling
- production Next.js build passed with 9/9 static pages

Preflight additionally proved:

- repeated validation JSON and Markdown are byte-identical for identical provenance
- npm audit found zero vulnerabilities
- base-to-head tree hygiene/scope review was clean
- no dependency lock/addition drift
- no dashboard/V5, Supabase migration, runtime-worker/network, or repository-runtime drift
- ground-truth corpus remains byte-identical through evaluation/reporting

## Important Task 5 history

The first real corpus run produced 14 TP / 2 FN because two positive GitHub-token fixtures used low-variety repeated-character placeholders that the scanner intentionally suppresses as obvious placeholders. A stricter exact-outcome test was witnessed RED first. Independent review confirmed scanner behavior was correct, and only the synthetic fixture values were corrected to high-variety detector-shaped strings. Scanner logic was not weakened to make the corpus pass.

The root TypeScript project also initially compiled the scanner-target fixture repositories. A regression test was witnessed RED before `validation/corpus` was excluded from application typecheck.

## Phase 8B - next

Build a broader deterministic performance matrix while preserving `scanner-medium-v1` unchanged:

1. source/AST-heavy generated fixture
2. dependency/lockfile-heavy fixture
3. IaC-heavy fixture

Every measurement must keep correctness gates, exact environment provenance, raw wall time, and an honest memory signal. Comparative claims require repeated runs. Catastrophic ceilings must be justified and must not be presented as product SLOs.

Phase 8B remains local/offline unless a separately approved design explicitly changes that boundary.

## Phase 8C - later

Publish reproducible technical validation reports from normalized Phase 8A/8B evidence, including exact provenance, raw counts, benchmark results, errors/unsupported cases, limitations, and explicit coverage scope.

## Vercel and production

- production domain: `scopeforge.dev`
- Phase 8A merge deployment: `dpl_BSfMBBxjgmFZHWmzAy5RN5N6Jvyj`
- state: READY
- `aliasError=null`

Phase 8A does not authorize any production worker capability change.

## Runtime gates

Keep false/absent unless separate operational acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## UI isolation

Dashboard V5/UI remains separate. Do not edit, merge, replace, retarget, or deploy the active V5/UI branch from Phase 8 work.

## Branch cleanup

The Phase 8A feature branch is merged but has not been deleted. Delete it only with a true remote delete-ref action. The connected GitHub tool surface currently exposes no branch-delete operation, so leave the ref unchanged rather than force-moving it. Preserve PR #49 and all active Command Center/V5/UI branches.
