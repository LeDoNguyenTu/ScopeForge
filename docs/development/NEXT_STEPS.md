# ScopeForge Next Steps

Last reconciled: 2026-09-05 (Asia/Singapore)

## Immediate priority - finish Phase 7 PR #54

Base:

`main` at `4ec80199ed922a5d9c92041e5432a8355f4a4277`

Branch:

`feat/phase-7-community-security-packs-v1`

Fully tested executable/source candidate:

`e8bef81d36090402cab7af77e549e3ef268c4eef`

Tasks 1-8 are implemented. Task 9 source/security preflight is complete with no unresolved reportable finding. Read `PHASE_7_RELEASE_STATE.md`.

Exact remaining sequence:

1. commit the documentation-only release checkpoint with `[skip ci]`
2. confirm the new PR head differs from `e8bef81d...` only in documentation
3. rerun whitespace/path/commit-hygiene and targeted documentation checks
4. confirm Vercel status and no unresolved PR review thread
5. convert PR #54 to draft, then mark ready exactly once to trigger `ready_for_review` CI on the same frozen SHA
6. require the `validate` job to pass on that exact SHA
7. recheck head/base/mergeability
8. integrate with exact-head protection, preferably squash merge with a `[skip ci]` release subject
9. keep all hosted worker/runtime capability flags false/absent

Do not create additional speculative RED CI runs.

## After Phase 7 - Phase 8 broader implementation

The methodology foundation from PR #50 already exists. Remaining non-UI Phase 8 work includes:

- vulnerable/ground-truth labs and fixture corpora
- precision/recall/false-positive measurement where technically meaningful
- reproducible scanner benchmark methodology
- regression datasets
- limitations documentation
- public technical validation reports

Phase 8 must not overstate accuracy where ground truth is incomplete.

## Separate production worker acceptance

Code-complete is not production-enabled.

### Phase 6B acquisition

Keep `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED=false` until the acquisition worker/private artifact runtime has its own operational acceptance, monitoring, rollback, and canary evidence.

### Phase 6C zero-egress scanning

Keep `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED=false` until the dedicated scanner runtime has real execution-boundary acceptance for zero egress, read-only boundaries, resource enforcement, and cancellation/container termination.

### Phase 6D runtime workers

Keep `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED=false` and `HOSTED_ACTIVE_CORS_WORKER_ENABLED=false` until each separately passes image/source identity, operational monitoring/rollback, and staged canary enablement.

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

Dashboard V5/UI preview work is a separate branch/workstream. Do not edit, merge, replace, retarget, or deploy it from the non-UI roadmap. Reconcile only after both streams have stable acceptance evidence.
