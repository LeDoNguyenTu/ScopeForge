# Phase 7 Release State

Last reconciled: 2026-09-05 (Asia/Singapore)

## Status

Phase 7 Community Security Packs v1 is at the final Task 9 integration gate in PR #54. Tasks 1-8 are implemented. The source/security candidate is fully preflighted; one exact-head GitHub Actions run is still required to provide explicit non-root Linux release evidence before merge.

## Exact refs

- repository: `LeDoNguyenTu/ScopeForge`
- branch: `feat/phase-7-community-security-packs-v1`
- PR: `#54 - Phase 7 community security packs implementation`
- exact base: `main` at `4ec80199ed922a5d9c92041e5432a8355f4a4277`
- fully tested executable/source candidate: `e8bef81d36090402cab7af77e549e3ef268c4eef`
- Phase 6D PR #52 is merged; Phase 7 is not blocked on Phase 6D.

The final documentation checkpoint is a documentation-only descendant of the executable candidate. Its exact SHA is the PR head and must be used for the final CI and merge checks.

## Implemented v1 boundary

- closed `static_literal_v1` matcher only
- strict bounded unique-key manifest parsing
- bounded non-backtracking path-pattern engine
- identity-checked repository byte reads
- deterministic literal findings/fingerprints/order
- explicit selected-pack registry with fixed pack/rule ceilings
- safe positive/negative/suppressed fixture discovery and behavioral validation
- `scopeforge pack validate`
- deterministic `scopeforge pack inspect --json`
- repeated explicit `scopeforge scan --pack`
- native JSON/SARIF/terminal/baseline compatibility
- permanent hosted-json rejection of Security Pack findings
- first-party `org.scopeforge.node-tls@1.0.0` example pack
- author/reviewer governance documentation

No pack auto-discovery exists. Target repositories cannot grant themselves detector authority.

## Preflight evidence on executable candidate `e8bef81d...`

- focused Phase 7 matrix: 19/19 test files, 129/129 tests passed
- full repository suite: 299/299 test files, 1,282/1,282 tests passed
- `npm run typecheck`: passed
- `npm run build:cli`: passed
- CLI version: `ScopeForge 0.1.0`
- first-party pack validation: `Security Pack valid: org.scopeforge.node-tls@1.0.0 (1 rules, 3 cases)`
- repeated pack inspection: byte-identical output
- scanner benchmark: 700 files, zero findings/errors, 338 ms wall time against the 20,000 ms ceiling
- `npm audit`: zero vulnerabilities at info/low/moderate/high/critical
- Vercel Preview build: `READY`; compilation/type validation passed and 9/9 pages prerendered

The disposable verification VM runs as root and cannot change UID, so it is not counted as the non-root Linux release gate. GitHub Actions on `ubuntu-latest` is reserved for that final exact-head confirmation after all documentation-only changes are preflighted.

## Security-diff review

Verdict: no reportable unresolved source/security finding identified in the base-to-source-candidate review.

Reviewed areas:

- pack root and fixture traversal/containment
- symlink, hard-link, special-file and directory-identity handling
- TOCTOU-sensitive manifest/fixture reads
- duplicate JSON keys, strict UTF-8, hostile controls and bounded contributor text
- path-pattern complexity and fixed resource ceilings
- explicit pack selection and absence of target-repository auto-discovery
- source/literal/fixture/absolute-path leakage boundaries
- deterministic finding identity/order/location/version behavior
- hosted import/export isolation
- process/network/dynamic-import/VM/browser dependency boundaries

Static primitive review found no Phase 7 child-process, network, VM, dynamic-import, or browser authority. The parser's `STRICT_SEMVER.exec(...)` is a regular-expression match on the trusted version-format grammar, not process execution. Path matching itself does not use RegExp/backtracking.

## Drift and scope review

Base-to-source candidate changes contain:

- no `package.json` change
- no `package-lock.json` change
- no Supabase migration change
- no dashboard V5/UI source change
- no hosted worker/runtime capability enablement
- no production network authority widening

`vercel.json` carries the browser-safe public ScopeForge Supabase URL/publishable key so Preview builds can prerender auth pages. This was verified by a successful Vercel Preview deployment. No service-role/server secret was committed and no production capability flag changed.

Two Markdown hard-break trailing-space lines in the original design header were identified during release review and removed in the final documentation checkpoint so the base-to-head diff is whitespace-clean.

Historical branch commit hygiene includes 15 early Phase 7 commits without `[skip ci]`, which explains several prior CI runs. They predate the current preflight-first policy. Do not create further speculative CI runs. Prefer squash integration so `main` receives one reviewed Phase 7 release commit rather than the noisy development history.

## Runtime capability state

Keep all of these false/absent through Phase 7 integration:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 7 merge does not authorize any worker/runtime enablement.

## Final gate

1. Preflight the exact documentation head and confirm its delta from `e8bef81d...` is documentation-only.
2. Confirm GitHub/Vercel PR status and no unresolved review thread.
3. Toggle PR #54 draft -> ready once to trigger the workflow's `ready_for_review` event on the same exact SHA.
4. Require the CI validate job to pass on that exact head.
5. Reconfirm PR head/base and mergeability after CI.
6. Integrate with exact-head protection. Prefer squash merge with a `[skip ci]` release subject to avoid carrying the historical TDD CI-trigger commit noise into `main`.
7. Do not change the active dashboard V5/UI branch.

## After Phase 7

The next non-UI architecture boundary is broader Phase 8 validation/benchmark/public-methodology implementation. Worker production enablement and Phase 9 hardening remain separate operational/security workstreams.
