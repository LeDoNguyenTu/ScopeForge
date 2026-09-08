# ScopeForge Implementation Log

Last refreshed: 2026-09-07 (Asia/Singapore)

This log records major delivery boundaries. Detailed task evidence remains in phase specs, plans, release documents, and Git history.

## Phases 1-5C

- Phase 1 established identity, workspaces, tenancy/RLS, application shell, security headers, CI, and deployment baseline.
- Phase 2 added workspace-scoped assets, proof-of-control, SSRF-safe verification, quotas, audit state, and authorization boundaries.
- Phase 3 delivered the local/passive code and supply-chain scanner, bounded hostile-repository inventory/reads, normalized findings, secrets, JS/TS SAST, bounded taint analysis, SCA/SBOM, IaC/configuration rules, baselines, JSON/SARIF, golden outputs, and benchmark methodology.
- Phase 4A added provider-neutral security-domain contracts.
- Phase 4B added verified passive runtime observations with target authorization and pinned network safety.
- Phase 4C-1 added the separately authorized bounded CORS validation profile.
- Phase 5A added the hosted canonical finding/evidence/history ledger.
- Phase 5B added remediation, deterministic retest, and Security Story workflows.
- Phase 5C added privacy-reduced hosted Phase 3 finding import without hosted repository execution.

## Phase 6

- Phase 6A added the closed zero-egress worker foundation.
- Phase 6B added public GitHub repository acquisition and immutable private source snapshots.
- Phase 6C added isolated zero-egress Phase 3 scanning over immutable snapshots.
- Phase 6D implementation merged through PR #52 into `main` at `4ec80199ed922a5d9c92041e5432a8355f4a4277` after real Linux rootless-Podman/cgroup-v2 acceptance.
- Phase 6D merge left all production runtime capability flags disabled. Runtime enablement remains a separate operational gate.

## Phase 7 Community Security Packs - complete

PR #54 merged as `1e9a72e0c4a526b064d6d3729981b405fac6b2b1`.

Delivered strict bounded data-only pack contracts, safe fixture validation, deterministic findings/registry/order, local CLI pack operations, output compatibility, hosted-json rejection, authority guards, a first-party example pack, and author/reviewer governance.

Final CI #756 passed 299 test files / 1,282 tests plus typecheck, CLI build/version, benchmark, and production build. Production deployment `dpl_9dHDoELwaxXMgAerv8LufwDEjC8B` was READY on `scopeforge.dev`.

## Phase 8A offline accuracy foundation - complete

PR #55 merged as `8d766f5969427a2e4525f5232b5e28b0f93675bd`.

Delivered:

- strict bounded ground-truth corpus/case schemas
- hostile-safe no-follow corpus/repository reads and deterministic hashing
- closed ownership for eight built-in rules
- TP/FN/FP/TN plus error/unsupported/contract-mismatch accounting
- null-safe precision/recall/FPR/F1
- deterministic privacy-reduced JSON/Markdown reports and local runner
- committed `scopeforge-offline-v1@1.0.0` corpus
- authority/privacy/ground-truth-integrity architecture guards

Final covered corpus: 32 cases, TP 16 / FN 0 / FP 0 / TN 16, errors 0, unsupported 0, contract mismatches 0. These results apply only to the committed corpus.

Final CI #758 passed 312 test files / 1,348 tests plus typecheck, CLI build/version, historical benchmark, and production build.

## Phase 8B scanner performance matrix - complete

PR #56 squash-merged into `main` as `226a20739871c15d0262d1779b3b013520f47fc6` from final head `e09710560d2451039b493e4c777dcddf1e62a1cd`.

Delivered:

- shared deterministic benchmark harness with exact correctness contracts
- `dependency-lockfile-heavy-v1` with 5,000-component SCA preflight and OSV disabled
- `iac-heavy-v1` with 601 files and four exact sentinel findings
- `source-ast-heavy-v1` with 1,201 files and four exact dynamic-code findings
- three repeated runs per profile
- scanner duration, wall time, and observational RSS-delta reporting
- permanent `benchmark:matrix` CI integration after the historical benchmark
- consolidated validation methodology and regression coverage

CI admission measurement was 15.561 s total matrix wall against a <=30 s rule, so permanent CI integration was accepted.

Release acceptance:

- preflight: 318/318 test files, 1,379/1,379 tests, typecheck, CLI build/version, historical benchmark, matrix, npm audit with 0 vulnerabilities, and production Next build
- final PR CI #760: success on merge ref `5636fdfea10534dea1a4e126113ba659168e208a`
- post-merge main CI #761: success on `226a20739871c15d0262d1779b3b013520f47fc6`
- main CI historical benchmark: 700 files, 0 findings/errors, 644 ms wall
- main CI matrix median walls: dependency 2,392 ms; IaC 426 ms; source/AST 1,034 ms
- exact production deployment `dpl_EQUz8d1CUjszH4e2Bh8qu1VDrHCu`: READY, `aliasError=null`, aliased to `scopeforge.dev`

Phase 8B changed no dashboard/V5/UI path, Supabase migration, production worker/runtime authority, dependency lockfile, or historical medium benchmark implementation.

## Current continuation

Phase 8C reproducible technical publication is the next Phase 8 boundary. Production worker enablement and Phase 9 hardening remain separate queues.

## CI process

Standing release process:

1. isolated exact-tree preflight first
2. `[skip ci]` for intermediate/docs-only checkpoints where CI adds no executable evidence
3. freeze one release candidate
4. require exact-head/merge-ref CI and hosting evidence
5. diagnose failures before reruns
6. merge with expected-head protection
7. verify `main` and production before recording completion
