# Phase 6D Claim and Preparation Sequencing Clarification

Status: normative clarification for `2026-08-30-phase-6d-network-workers.md`.

## Reason

The existing Phase 4 execution-time authorization functions accept only queued domain jobs. Therefore Phase 6D must not reuse the existing generic claim behavior that transitions a `scan_jobs` row to `running` when a worker task is leased.

## Required sequence

1. `claim_runtime_worker_task` leases only the private Phase 6D worker task and creates the worker attempt/lease.
2. The referenced public domain job remains `queued` after claim.
3. A queued-job cancellation remains authoritative. If cancellation occurs before preparation, the domain job may transition directly to `cancelled` and preparation must fail closed.
4. The worker calls the trusted preparation endpoint with exact task, attempt, class, and lease identity.
5. The control plane loads the still-queued domain job and current asset.
6. The control plane runs the existing `reauthorizeRuntimeObservationExecution` or `reauthorizeActiveValidationExecution` unchanged.
7. Only after successful reauthorization, and while holding the required database serialization/row locks, the control plane transitions the domain job from `queued` to `running` and issues the lease-bound prepared profile.
8. The prepared profile is invalid if the worker task/attempt/lease is no longer current, the domain job is not the just-authorized running job, cancellation becomes authoritative, or the deadline expires.
9. No network mediator session may execute before the successful preparation response.

## Race requirements

The implementation must prevent a gap where reauthorization succeeds but an asset or job state change can be ignored before the running transition. The trusted preparation path must serialize the relevant domain job and asset state using the repository/database transaction pattern appropriate to the existing Supabase control layer.

If the asset authorization snapshot changes before preparation commits, preparation fails and no network activity is permitted.

If cancellation becomes authoritative before preparation commits, cancellation wins and no network activity is permitted.

## Generic worker behavior

The generic `claim_worker_task` behavior used by earlier worker classes must not be broadened or silently changed for Phase 6D. Phase 6D uses its dedicated claim/preparation path because its execution-time authorization semantics are different.

## Acceptance tests

Phase 6D tests must prove:

- claim leaves passive and active domain jobs queued;
- preparation sees a queued job and calls the unchanged Phase 4 reauthorization function;
- successful preparation transitions the job to running exactly once;
- pre-preparation cancellation prevents the running transition;
- stale/wrong/expired leases cannot transition the domain job;
- a worker cannot obtain a prepared profile for an already-running job from another attempt;
- no direct network execution occurs between claim and preparation.
