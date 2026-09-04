# ScopeForge Test Status

Last reconciled: 2026-09-05 (Asia/Singapore)

## Phase 7 final release evidence

Merged release:

`1e9a72e0c4a526b064d6d3729981b405fac6b2b1`

Accepted PR head:

`b10f04f87ff06a81106b585973c3e7872571bfa6`

Base validated by CI:

`4ec80199ed922a5d9c92041e5432a8355f4a4277`

GitHub Actions CI #756 checked out the synthetic PR merge ref `a0f001b831e4c2a13778d8e4261c896cd7084184`, so it validated the actual proposed integration tree.

Final CI results:

- `npm ci --ignore-scripts --no-audit --no-fund`: passed
- `npm test`: 299/299 files, 1,282/1,282 tests passed
- `npm run typecheck`: passed
- `npm run build:cli`: passed
- CLI version: `ScopeForge 0.1.0`
- scanner benchmark: 700 files, zero findings/errors, 888 ms wall time / 20,000 ms ceiling
- `npm run build`: passed, including 9/9 static pages

Preflight on executable candidate `e8bef81d36090402cab7af77e549e3ef268c4eef` additionally recorded:

- focused Phase 7 suite: 19/19 files, 129/129 tests
- repeated `pack inspect --json`: byte-identical
- first-party pack validation: passed
- npm audit: zero vulnerabilities at all severities
- source/security review: no unresolved reportable finding

## Production verification

Vercel deployment for the Phase 7 squash merge:

`dpl_9dHDoELwaxXMgAerv8LufwDEjC8B`

State: READY

Aliases include `scopeforge.dev`; `aliasError=null`.

## CI policy

Earlier Phase 7 TDD checkpoints created unnecessary red-status noise. The standing policy is now:

- preflight executable changes outside Actions first
- use `[skip ci]` for intermediate/docs-only checkpoints
- freeze a candidate before final CI
- never blind-rerun a failed CI job; diagnose first

## Production capability statement

Passing or merging Phase 7 is not permission to enable repository acquisition, repository scanning, passive runtime workers, or active CORS workers. Those remain separately gated.
