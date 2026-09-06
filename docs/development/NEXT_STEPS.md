# ScopeForge Next Steps

Last reconciled: 2026-09-06 (Asia/Singapore)

## Phase 7 - complete

PR #54 merged as `1e9a72e0c4a526b064d6d3729981b405fac6b2b1` after exact-head CI #756 passed. Do not recreate Phase 7 Tasks 1-9.

## Phase 8A - complete

PR #55 merged into `main` as `8d766f5969427a2e4525f5232b5e28b0f93675bd` from final accepted head `9b1fd4a26924f8fff21ce5f9614b8fc4e0e20510`.

Final CI #758 validated PR merge ref `479cffade6143852dfd9dabbd344271d729f6ba3`:

- 312/312 test files and 1,348/1,348 tests passed
- typecheck passed
- CLI build/version passed
- scanner benchmark passed at 910 ms / 20,000 ms catastrophic ceiling
- production Next.js build passed with 9/9 static pages generated

Production deployment `dpl_BSfMBBxjgmFZHWmzAy5RN5N6Jvyj` is READY on `scopeforge.dev` with `aliasError=null`.

Committed corpus:

- `scopeforge-offline-v1@1.0.0`
- content hash `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`
- 32 cases / 8 rules / 3 scanner families
- TP 16 / FN 0 / FP 0 / TN 16
- errors 0 / unsupported 0 / contract mismatches 0

These metrics are limited to the committed covered corpus and are not global or real-world ScopeForge accuracy.

Do not recreate Phase 8A Tasks 1-8.

## Immediate non-UI priority - Phase 8B performance matrix

Build a broader performance matrix while preserving `scanner-medium-v1` unchanged as the historical clean medium-repository fixture.

Planned workload classes:

1. source/AST-heavy generated repository
2. dependency/lockfile-heavy repository
3. IaC-heavy repository

Requirements:

- deterministic fixture generation and stable fixture identities
- correctness gates attached to every performance measurement
- exact commit, Node, OS, architecture, and environment provenance
- raw scanner duration and measured wall time
- memory signal where available, explicitly not mislabeled as peak RSS unless measured as such
- repeated runs for comparative claims; never report only the fastest run
- justified catastrophic regression ceilings rather than fabricated product SLOs
- no accuracy/performance conflation
- no hosted/network capability added merely to benchmark local scanners
- preserve Phase 8A authority/privacy boundaries and existing worker runtime gates

## Phase 8C - later

Produce reproducible technical validation reports from normalized Phase 8A/8B evidence.

Reports should include:

- exact commit
- corpus/fixture identity and hash
- rule versions
- raw counts and derived metrics where defined
- benchmark evidence and environment
- errors/unsupported cases
- limitations and known blind spots
- explicit covered-corpus scope

Do not publish repository-wide or scanner-wide accuracy claims until the corpus supports that aggregation.

## Separate production worker acceptance

Code-complete is not production-enabled.

### Phase 6B acquisition

Keep `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED=false` until its separate operational monitoring/rollback/canary acceptance is complete.

### Phase 6C zero-egress scanning

Keep `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED=false` until real execution-boundary acceptance proves zero egress, read-only input/rootfs, resource enforcement, and cancellation/container termination.

### Phase 6D runtime workers

Keep `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED=false` and `HOSTED_ACTIVE_CORS_WORKER_ENABLED=false` until each separately passes operational monitoring/rollback and staged canary enablement.

Do not infer Phase 6D containment automatically authorizes 6B or 6C.

## Phase 9 hardening

Concrete non-UI hardening still includes:

- enable/review Supabase leaked-password protection
- abuse prevention and threat review
- Turnstile/equivalent integration only if actually implemented
- production observability/alerting
- private-schema defense-in-depth without breaking RPC-only worker authority
- incident/rollback procedures
- release engineering and final public-launch security review

Accessibility/responsive QA should occur after dashboard V5 visual work is finalized.

## UI isolation

Dashboard V5/UI preview work is a separate branch/workstream. Do not edit, merge, replace, retarget, or deploy it from the non-UI roadmap.

## Branch cleanup

The merged Phase 8A branch should be deleted only using a genuine remote delete-ref operation. The current connected GitHub tool surface does not expose branch deletion, so leave it unchanged. Never force-move the ref to simulate cleanup. Preserve PR #49 and all active V5/UI branches.
