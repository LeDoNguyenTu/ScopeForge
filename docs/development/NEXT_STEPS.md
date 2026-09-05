# ScopeForge Next Steps

Last reconciled: 2026-09-06 (Asia/Singapore)

## Phase 7 - complete

PR #54 merged as `1e9a72e0c4a526b064d6d3729981b405fac6b2b1` after exact-head CI #756 passed. Do not recreate Phase 7 Tasks 1-9.

## Immediate non-UI priority - finish Phase 8A

Phase 8A Accuracy Foundation is implemented on `feat/phase-8a-accuracy-foundation-v1` and is now at release/integration gates.

Latest fully verified executable/security head before documentation: `593fc5655b538502dc3906d81794aa462f98022d`.

Committed corpus:

- `scopeforge-offline-v1@1.0.0`
- 32 cases
- 8 rules
- 3 scanner families
- content hash `3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f`
- covered-corpus result: TP 16 / FN 0 / FP 0 / TN 16
- errors 0 / unsupported 0 / contract mismatches 0

These metrics are limited to the committed covered corpus and are not global ScopeForge accuracy.

Remaining Phase 8A work:

1. complete documentation-only reconciliation
2. run full exact-tree Linux preflight on the final candidate
3. run full repository tests, typecheck, CLI build/version, scanner benchmark, npm audit, and production build
4. perform base-to-head diff/security/authority/UI-isolation review
5. inspect current `main` for advancement/conflicts before PR integration
6. verify Vercel Preview separately from scanner evidence
7. open/reconcile the Phase 8A PR
8. trigger exactly one final exact-head GitHub Actions run after preflight is green
9. merge only if exact head/base/status/review invariants remain clean
10. perform post-merge production/handoff verification
11. clean safely merged/stale backend branches where branch-deletion tooling is actually available, preserving all active V5/UI branches

Do not create intentional hosted RED runs. Diagnose any failed preflight/CI before another run.

## Phase 8B - next after Phase 8A merge

Build a broader performance matrix while preserving `scanner-medium-v1` unchanged.

Planned workload classes:

- generated source/AST-heavy repository
- dependency/lockfile-heavy repository
- IaC-heavy repository

Requirements:

- deterministic fixture generation
- correctness gates attached to each performance measurement
- raw wall time and environment provenance
- memory signal where available
- justified catastrophic ceilings rather than fabricated product SLOs
- no accuracy/performance conflation

## Phase 8C - later

Produce reproducible technical validation reports from normalized evidence.

Reports should include:

- exact commit
- corpus/fixture identity and hash
- rule versions
- raw counts and derived metrics where defined
- benchmark evidence
- Node/OS/architecture
- errors/unsupported cases
- limitations and known blind spots
- explicit covered-corpus scope

Do not publish repository-wide or scanner-wide accuracy claims until the corpus supports the aggregation.

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
