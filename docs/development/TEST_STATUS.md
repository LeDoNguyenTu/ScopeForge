# ScopeForge Test Status

Last reconciled: 2026-09-06 (Asia/Singapore)

## Phase 8A final release evidence

Merged PR #55:

- final accepted head: `9b1fd4a26924f8fff21ce5f9614b8fc4e0e20510`
- validated PR merge ref: `479cffade6143852dfd9dabbd344271d729f6ba3`
- squash merge on `main`: `8d766f5969427a2e4525f5232b5e28b0f93675bd`
- exact final CI: #758, success

GitHub Actions CI #758 ran on Ubuntu 24.04.4 with Node 22.23.2 and passed:

- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm test`: 312/312 test files, 1,348/1,348 tests
- `npm run typecheck`
- `npm run build:cli`
- compiled CLI version: `ScopeForge 0.1.0`
- `npm run benchmark:scanner`: `scanner-medium-v1`, 700 files, 0 findings, 0 errors, 853 ms scanner duration, 910 ms wall time, 29,069,312 byte RSS delta, 20,000 ms ceiling
- `npm run build`: success, including 9/9 static pages

The draft synchronize workflow #757 was skipped by the workflow's draft guard. CI #758 was the one substantive final GitHub Actions validation run for Phase 8A.

## Phase 8A corpus acceptance

Corpus:

- ID/version: `scopeforge-offline-v1@1.0.0`
- content hash: `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`
- 32 cases
- 16 vulnerable / 16 clean
- 8 represented rules
- 3 scanner families
- 97 corpus files

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

The first real corpus run produced 14 TP / 2 FN because two synthetic GitHub-token positives used low-variety repeated-character placeholders. Independent review confirmed the secret scanner correctly suppresses obvious placeholders. The fixture values, not scanner logic, were corrected to high-variety detector-shaped synthetic strings after a tightened exact-outcome test was witnessed RED.

The root TypeScript project initially tried to compile scanner-target repositories because `tsconfig.json` included every repository TypeScript file. A regression test was witnessed RED before `validation/corpus` was excluded from application typecheck. The corpus remains scanned by Phase 8A itself.

## Phase 8A security/preflight evidence

Before final CI, exact-tree preflight established:

- focused validation/architecture suite green
- typecheck and CLI build/version green
- validation JSON and Markdown byte-identical across repeated runs with identical provenance
- `npm audit --audit-level=info`: zero vulnerabilities
- local `scanner-medium-v1`: 700 files, 0 findings/errors, 355 ms wall time / 20,000 ms ceiling
- complete 133-file base-to-head review: no trailing-whitespace additions, no conflict markers, no dashboard/V5 paths, no Supabase migration paths, no runtime-worker/network/repository-runtime paths
- `package-lock.json` unchanged and no dependency additions
- no forbidden hosted/runtime/network/dynamic-execution authority primitive in `packages/validation-accuracy`
- complete 97-file ground-truth corpus byte-identical through evaluation/reporting
- reports exclude fixture content, synthetic secret values, absolute roots, evidence, metadata, remediation text, and timing fields

## Production verification

Exact Phase 8A merge deployment:

`dpl_BSfMBBxjgmFZHWmzAy5RN5N6Jvyj`

State: READY. `aliasError=null`. Aliases include `scopeforge.dev`.

## Historical Phase 8A TDD checkpoints

- Task 1 GREEN: `77a2f3c1223e416a4264453cdd48c7f4a13a09fa`
- Task 2 GREEN: `5f22a7ae2856070159dd192c9426ef1f754bb5c7`
- Task 3 GREEN: `afbffd9b66b424d08af6888340cdb149eda66fdb`
- Task 4 GREEN: `90d0206437f97719898038a20907fbd8a9e46952`
- Task 5 accepted corpus: `398e645abda04e66d0f0c92d2238ad4df9f1c0c4`
- Task 6 authority/security GREEN: `593fc5655b538502dc3906d81794aa462f98022d`
- frozen preflight tree: `c0b46ac5243b0592b5f33d8019a5f751606bf760`
- tree-identical final verification head: `9b1fd4a26924f8fff21ce5f9614b8fc4e0e20510`

## Production capability statement

Phase 8A validation success is not permission to enable repository acquisition, hosted repository scanning, passive runtime workers, or active CORS workers. Those capabilities remain separately gated.
