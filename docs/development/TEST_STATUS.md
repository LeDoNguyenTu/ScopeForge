# ScopeForge Test Status

Last reconciled: 2026-09-06 (Asia/Singapore)

## Phase 8A current verification evidence

Active branch:

`feat/phase-8a-accuracy-foundation-v1`

Latest fully verified executable/security head before Task 7 docs:

`593fc5655b538502dc3906d81794aa462f98022d`

### Baseline before Phase 8A implementation

Exact reviewed starting head `be5395f053a9983c097ed516e14f8dd6cd495a09`:

- 299/299 test files passed
- 1,282/1,282 tests passed
- typecheck passed

### Task 1

Exact GREEN `77a2f3c1223e416a4264453cdd48c7f4a13a09fa`:

- 22/22 focused tests passed
- typecheck passed

### Task 2

Exact GREEN `5f22a7ae2856070159dd192c9426ef1f754bb5c7`:

- 20/20 focused tests passed
- typecheck passed

### Task 3

Exact GREEN `afbffd9b66b424d08af6888340cdb149eda66fdb`:

- 15/15 focused tests passed
- typecheck passed

### Task 4

Exact GREEN `90d0206437f97719898038a20907fbd8a9e46952`:

- 12/12 report/runner/privacy tests passed
- typecheck passed
- CLI build passed
- compiled CLI version: `ScopeForge 0.1.0`

### Task 5 corpus acceptance

Exact accepted corpus head:

`398e645abda04e66d0f0c92d2238ad4df9f1c0c4`

Corpus:

- ID/version: `scopeforge-offline-v1@1.0.0`
- content hash: `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`
- 32 cases
- 8 represented rules
- 3 scanner families
- 97 corpus files

Exact acceptance commands passed:

- Phase 8A validation suite: 11/11 files, 62/62 tests
- `npm run typecheck`
- `npm run build:cli`
- compiled CLI version `ScopeForge 0.1.0`
- compiled validation runner wrote deterministic JSON and Markdown outside the corpus

Raw covered-corpus result:

- TP 16
- FN 0
- FP 0
- TN 16
- error 0
- unsupported 0
- contract mismatch 0

Derived covered-corpus metrics:

- precision 1.00
- recall 1.00
- false-positive rate 0.00
- F1 1.00

These are **not global ScopeForge accuracy metrics**. They describe only the 32 reviewed cases in the committed corpus.

The first real corpus run produced 14 TP / 2 FN because the two synthetic GitHub token positives used intentionally low-variety repeated-character placeholders. Independent review confirmed the secret scanner correctly suppresses obvious placeholders. The fixture values, not scanner logic, were corrected to high-variety detector-shaped synthetic strings. A tightened exact-outcome test was witnessed RED before the fixture correction, then GREEN after it.

The root TypeScript project initially tried to compile scanner-target fixture repositories because `tsconfig.json` included all repository TypeScript files. A regression test was witnessed RED, then `validation/corpus` was excluded from application typecheck. The corpus remains scanned by Phase 8A itself.

### Task 6 authority/security acceptance

Exact GREEN:

`593fc5655b538502dc3906d81794aa462f98022d`

- 13/13 focused files passed
- 66/66 tests passed
- typecheck passed

Verified boundaries:

- no forbidden hosted/runtime/network/worker imports or primitives in `packages/validation-accuracy`
- all 97 corpus files remain byte-identical through evaluation/report generation
- runner rejects output paths inside the corpus before either output is written
- reports exclude fixture contents, synthetic credentials, absolute roots, evidence, metadata, remediation text, and timing fields

## GitHub Actions usage policy for Phase 8A

No GitHub Actions run has been spent on Phase 8A intermediate TDD work so far.

Standing policy:

- witness RED/GREEN in disposable exact-SHA Linux preflight
- intermediate commits use `[skip ci]`
- diagnose local/preflight failures before changing code
- freeze the final candidate before CI
- run exactly one final GitHub Actions confirmation unless a diagnosed defect genuinely requires a repaired candidate
- never blind-rerun a failed CI job

## Phase 8A final gate still pending

Before merge, the final exact tree still needs:

- docs-sensitive focused tests
- full repository test suite
- typecheck
- CLI build/version
- scanner benchmark
- npm audit
- production Next.js build
- base-to-head diff/security/authority/UI-isolation review
- Vercel Preview verification separately from scanner evidence
- one exact-head GitHub Actions confirmation
- PR review/mergeability/status reconciliation

## Phase 7 historical release evidence

Phase 7 merged through PR #54 as `1e9a72e0c4a526b064d6d3729981b405fac6b2b1` after CI #756 passed on the accepted integration tree:

- 299/299 files
- 1,282/1,282 tests
- typecheck
- CLI build/version
- scanner benchmark
- production Next.js build

## Production capability statement

Phase 8A validation success is not permission to enable repository acquisition, hosted repository scanning, passive runtime workers, or active CORS workers. Those capabilities remain separately gated.
