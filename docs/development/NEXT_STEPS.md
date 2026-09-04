# ScopeForge Next Steps

Last reconciled: 2026-09-05 (Asia/Singapore)

## Phase 7 - complete

PR #54 merged as `1e9a72e0c4a526b064d6d3729981b405fac6b2b1` after exact-head CI #756 passed on `b10f04f87ff06a81106b585973c3e7872571bfa6`. Production Vercel deployment `dpl_9dHDoELwaxXMgAerv8LufwDEjC8B` is READY on `scopeforge.dev`.

Do not recreate Phase 7 Tasks 1-9.

## Immediate non-UI priority - broader Phase 8

The Phase 8 methodology foundation from PR #50 already exists. Continue from that foundation rather than redesigning it from scratch.

Remaining work includes:

1. define reviewed ground-truth/vulnerable lab corpus boundaries
2. implement deterministic corpus/evaluator contracts
3. measure precision/recall/false positives only where ground truth is defensible
4. add reproducible scanner benchmark/regression methodology
5. document limitations and methodology caveats
6. produce technical validation reports from reproducible evidence
7. keep Phase 8 local/offline unless a separately reviewed design requires hosted behavior

Do not overstate accuracy where ground truth is incomplete.

## Separate production worker acceptance

Code-complete is not production-enabled.

### Phase 6B acquisition

Keep `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED=false` until the acquisition worker/private artifact runtime has its own operational acceptance, monitoring, rollback, and canary evidence.

### Phase 6C zero-egress scanning

Keep `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED=false` until the dedicated scanner runtime has real execution-boundary acceptance for zero egress, read-only input/rootfs, resource enforcement, and cancellation/container termination.

### Phase 6D runtime workers

Keep `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED=false` and `HOSTED_ACTIVE_CORS_WORKER_ENABLED=false` until each separately passes source/image identity, operational monitoring/rollback, and staged canary enablement.

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
