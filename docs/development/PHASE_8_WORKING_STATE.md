# ScopeForge Phase 8 Working State

Last reconciled: 2026-09-06 (Asia/Singapore)

This is the authoritative resumable state for the non-UI Phase 8 validation workstream. Dashboard V5/UI remains a separate active branch/workstream and must not be modified from here.

## Repository and branch

- repository: `LeDoNguyenTu/ScopeForge`
- implementation branch: `feat/phase-8a-accuracy-foundation-v1`
- base `main` at Phase 8A branch creation: `222d9591dbd5e357d179eb06407b0787a2efef7f`
- latest fully verified executable/security head before Task 7 docs: `593fc5655b538502dc3906d81794aa462f98022d`
- exact Task 5 corpus acceptance head: `398e645abda04e66d0f0c92d2238ad4df9f1c0c4`
- approved design: `docs/superpowers/specs/2026-09-05-phase-8-validation-accuracy-design.md`
- authoritative implementation plan: `docs/superpowers/plans/2026-09-05-phase-8a-accuracy-foundation-v2.md`

All Phase 8A intermediate commits use `[skip ci]`. No GitHub Actions run has been spent on Phase 8A yet. The standing release policy is local/exact-head Linux preflight first, one frozen final Actions confirmation only after the feature is complete.

## Phase 8A scope

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

## Implemented Tasks 1-6

### Task 1 - strict corpus contracts and parser

Implemented:

- closed v1 corpus/case schemas
- bounded manifest/case/repository limits
- duplicate-key and unknown-field rejection
- strict case/rule/scanner identities
- positive/clean case invariants
- no-follow identity-checked reads
- symlink, hard-link, special-file, traversal, drive-path, and non-UTF-8 rejection
- deterministic complete repository-tree content hashing

Task 1 exact GREEN: `77a2f3c1223e416a4264453cdd48c7f4a13a09fa`

- 22/22 focused tests passed
- typecheck passed

### Task 2 - closed scanner ownership and classification

Implemented exact offline-v1 ownership for eight rules across `secrets`, `jsts`, and `iac`, with no SCA/OSV construction.

Classification keeps scanner errors/unsupported cases outside TP/FN/FP/TN, records unexpected rule IDs, requires the target finding in the expected file, and records metadata contract mismatches separately.

Task 2 exact GREEN: `5f22a7ae2856070159dd192c9426ef1f754bb5c7`

- 20/20 focused tests passed
- typecheck passed

### Task 3 - deterministic metrics and provenance

Implemented raw counts, null-safe derived metrics, stable case/rule ordering, deterministic provenance without timestamps, and the exact non-claim interpretation.

Task 3 exact GREEN: `afbffd9b66b424d08af6888340cdb149eda66fdb`

- 15/15 focused tests passed
- typecheck passed

### Task 4 - deterministic reports and developer runner

Implemented deterministic JSON/Markdown and the local validation runner with strict arguments and exclusive/no-follow output writes.

Task 4 exact GREEN: `90d0206437f97719898038a20907fbd8a9e46952`

- 12/12 report/runner/privacy tests passed
- typecheck passed
- CLI build passed
- compiled CLI version remained `ScopeForge 0.1.0`

### Task 5 - `scopeforge-offline-v1@1.0.0`

Committed corpus:

- 32 cases
- 16 vulnerable
- 16 clean/near-miss
- 8 represented rules
- 3 scanner families
- 97 corpus files

Corpus content hash:

`3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`

Exact Task 5 acceptance head:

`398e645abda04e66d0f0c92d2238ad4df9f1c0c4`

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

These values describe only the committed covered corpus and are not global ScopeForge accuracy.

Task 5 exact-head commands passed:

```text
npx vitest run tests/validation-accuracy/offline-v1-corpus.test.ts tests/validation-accuracy
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
node .scopeforge-build/packages/validation-accuracy/cli.js --corpus validation/corpus/offline-v1 --commit 398e645abda04e66d0f0c92d2238ad4df9f1c0c4 --json <outside-corpus.json> --markdown <outside-corpus.md>
```

The first corpus run exposed two false negatives caused by low-variety repeated-character synthetic GitHub token placeholders. Independent review confirmed the scanner intentionally suppresses obvious placeholders. The ground-truth fixtures were corrected to high-variety detector-shaped synthetic strings, then the tightened exact-outcome test was rerun GREEN. Scanner logic was not weakened or changed to make the score pass.

The committed corpus is excluded from the root application TypeScript project because its repositories are scanner targets, not ScopeForge application source. A regression test locks this tooling boundary.

### Task 6 - authority, privacy, and ground-truth integrity

Latest fully verified head before Task 7 docs:

`593fc5655b538502dc3906d81794aa462f98022d`

Exact focused acceptance:

- 13/13 files passed
- 66/66 tests passed
- typecheck passed

Guards prove:

- validation package has no Next/React/Supabase dependency
- no runtime network/observer/validator/worker/supervisor/control authority
- no hosted app/lib mutation dependency
- no child process, VM, HTTP/HTTPS/DNS/net/TLS/datagram, worker-thread authority
- no dynamic import, eval/new Function, fetch, or WebSocket primitive
- complete 97-file corpus is byte-identical before/after evaluation and report generation
- output paths inside the corpus fail before either report is written
- normalized JSON/Markdown exclude source contents, synthetic credential values, absolute roots, finding evidence, metadata, remediation text, and scan timing details

## Represented rules

- `iac/config-npm-strict-ssl-disabled`
- `iac/docker-floating-base-image`
- `iac/github-actions-write-all-permissions`
- `iac/kubernetes-privileged-container`
- `iac/terraform-aws-public-rds`
- `jsts/command-injection`
- `jsts/dynamic-code-execution`
- `secrets/github-token`

## Remaining Phase 8A work

1. Finish Task 7 documentation reconciliation.
2. Run the complete exact-tree Phase 8A preflight, including full repository tests, typecheck, CLI build/version, benchmark, npm audit, and production build where supported.
3. Perform source/security/diff review against current `main` and verify V5/UI isolation.
4. Open/reconcile the Phase 8A PR.
5. Trigger one final exact-head GitHub Actions run only after preflight is green.
6. Merge only if the exact PR head/base/status/review invariants remain clean.
7. Reconcile post-merge documentation.

## Phase 8B next

After Phase 8A is safely merged, Phase 8B should add a performance matrix without changing `scanner-medium-v1`:

- source/AST-heavy generated fixture
- dependency/lockfile-heavy fixture
- IaC-heavy fixture
- correctness gates attached to performance measurements
- justified catastrophic ceilings, not product SLO claims

## Phase 8C later

Phase 8C should publish reproducible technical reports from normalized evidence with exact provenance, raw counts, benchmark results, unsupported/error counts, limitations, and review rules.

## Vercel and production

Vercel status is a separate deployment concern from scanner validation. Phase 8A does not require or authorize production capability changes. Verify the feature-branch preview and final main deployment separately during integration.

Production domain remains `scopeforge.dev`.

## Runtime gates

Keep false/absent unless separate operational acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## UI isolation

Dashboard V5/UI remains separate. Do not edit, merge, replace, retarget, or deploy the active V5/UI branch from Phase 8A work.

## Branch cleanup requirement

After safe integration, clean merged/stale backend branches where tooling permits. Preserve PR #49 and all active Command Center/V5/UI branches. The current GitHub connector has not exposed remote branch deletion, so never fake cleanup by force-moving old refs.
