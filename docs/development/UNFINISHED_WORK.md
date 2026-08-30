# ScopeForge Unfinished Work Queue

Last reconciled: 2026-08-31

This file is the persistent resume queue for unfinished ScopeForge work. It exists so later sessions can continue from repository state rather than conversation memory.

## Global execution rules

- Do not use, trigger, rerun, or depend on GitHub Actions while the monthly allowance remains exhausted.
- Every repository commit made through the assisted workflow must contain `[skip ci]`.
- Do not claim tests, typecheck, builds, audits, database state, sandbox containment, or runtime gates are green without fresh execution evidence tied to the exact candidate SHA.
- Existing deployed Supabase migrations are immutable. Corrections are forward-only.
- Keep `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED=false` and `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED=false` unless separately reviewed acceptance authorizes them.
- Keep `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED=false` and `HOSTED_ACTIVE_CORS_WORKER_ENABLED=false` throughout Phase 6D implementation and merge. Phase 6D may merge disabled, but hosted network execution must not be enabled before real Linux containment acceptance.
- Turnstile is not active and must not be described as active.
- Do not add generic URL, HTTP, fetch, proxy, browser-automation, arbitrary-header/body, credential-replay, port-scanning, or unrestricted network authority.
- Phase 6B GitHub networking is not reusable Phase 6D egress authority.

## Active non-rate-limit queue

### 1. Phase 6D Task 9 - trusted result publication hardening

Current stacked branch:

`feat/phase-6d-network-workers-v1-task9`

Current head at this reconciliation:

`6c6fc300562e0b95fbf6a9b176cd46941d227b44`

Task 9 source currently contains:

- strict validation of normalized Phase 6D terminal output
- trusted deterministic passive runtime rule evaluation and mapping
- trusted deterministic active CORS rule evaluation and mapping
- exact worker/task/attempt/lease-bound finalization context
- cancellation-first publication behavior
- replay acceptance only for the same terminal digest
- lease-expiry carried into trusted finalization context
- a dedicated internal runtime finalization route
- a forward-only Phase 6D publication migration
- service-role-only publication RPC intent

Remaining Task 9 work before it can be called complete:

- finish source review of private worker-task terminal-state semantics for succeeded, failed, and cancelled outcomes
- confirm private broker task state matches the established Phase 6A/6C terminal conventions and cannot leave a leased task after domain-job finalization
- confirm failure/cancellation finalization never permits retry because Phase 6D uses `max_attempts = 1`
- confirm the forward publication migration rechecks exact class, binding, lease hash, cancellation, counters, metrics, and terminal digest under row locks
- confirm every `SECURITY DEFINER` function has `set search_path = ''`
- confirm browser roles have no execution grant to Phase 6D publication helpers
- confirm no raw remote response body, raw header map, cookie value, authorization data, resolver transcript, or remote exception string can cross publication
- confirm active CORS test fixtures use the real synthetic ScopeForge Origin semantics rather than wildcard behavior that the existing conservative rule intentionally ignores
- keep the migration unapplied until Task 13 source/authority review

Do not spend additional time on executable verification here while external runners are rate-limited. That verification belongs in the externally parked section below.

### 2. Phase 6D Task 10 - cut hosted dashboard runtime actions over to queued workers

Follow the reviewed plan in:

`docs/superpowers/plans/2026-08-30-phase-6d-network-workers.md`

Required behavior:

- add `lib/runtime-workers/request.ts`
- preserve the existing Phase 4 enqueue authorization before worker-task creation
- atomically create the authorized domain job and corresponding closed worker task when the relevant capability is enabled
- modify `app/dashboard/assets/[assetId]/runtime-actions.ts`
- modify `app/dashboard/assets/[assetId]/active-validation-actions.ts`
- server actions must continue accepting only asset ID, plus explicit-consent boolean for active CORS
- no URL, method, header, body, profile, budget, worker class, target, or network configuration may enter from the browser
- false capability must return truthful `RUNTIME_WORKER_UNAVAILABLE` before creating a dead domain/worker job
- after cutover, hosted actions must never call `executeRuntimeObservation` or `executeActiveValidation` directly
- there must be no `worker unavailable -> execute directly in Vercel` fallback
- cancellation remains job-ID scoped and must propagate through trusted control state to the worker/mediator
- UI/read model may be adjusted only enough to show queued, running, unavailable, cancelled, failed, and completed states truthfully
- do not enable either Phase 6D capability flag

Tests first:

- extend `tests/runtime-validator/action-boundary.test.ts`
- create `tests/runtime-observations/action-boundary.test.ts`
- extend existing runtime-observation/runtime-validator service tests only where needed to preserve direct domain logic as unit-testable code rather than hosted execution

### 3. Phase 6D Task 11 - queue backpressure, fleet health, and cancellation recovery

Required behavior:

- one live Phase 6D task per workspace across passive and active classes
- passive fleet leased concurrency cap: 2
- active CORS leased concurrency cap: 1
- existing global worker leased cap remains an additional ceiling
- passive workers claim only passive tasks; active workers claim only active tasks
- cancelled queued tasks become terminal without mediator startup
- cancellation of a leased task prevents success publication
- lost/expired Phase 6D attempts are terminal and never requeued because `max_attempts = 1`
- fleet health exposes only class availability/saturation and safe counts, never target identity or response data
- no new public daily quota values in Phase 6D

Planned tests:

- `tests/runtime-workers/backpressure.test.ts`
- `tests/runtime-workers/fleet.test.ts`
- relevant worker service and migration tests

### 4. Phase 6D Task 12 - permanent authority and import-graph guards

Create `tests/architecture/phase6d-runtime-workers.test.ts` and extend existing Phase 6B/6C guards.

Permanent invariants to lock:

- only the dedicated mediator and existing runtime-network package may own Phase 6D external networking primitives
- executor/sandbox code cannot import raw HTTP/HTTPS/TCP/DNS runtime authority
- dashboard/server actions cannot import runtime-network or mediator internals
- mediator cannot import Supabase admin/database repositories
- mediator cannot import R2, GitHub acquisition, scanner runner, model providers, browser automation, child process, VM, or worker-thread authority except the already-reviewed process boundary where explicitly intended outside the mediator
- Phase 6B acquisition cannot import Phase 6D mediator code
- Phase 6C zero-egress scanning cannot import Phase 6D mediator or runtime network
- no generic URL/fetch/http/proxy execution class or public contract may appear
- Phase 6D executor sandbox command permanently includes `--network=none`
- do not weaken an architecture guard for implementation convenience

### 5. Phase 6D Task 13 - complete source review and Supabase reconciliation

This begins only after Tasks 9-12 are source-complete.

Before applying SQL:

- compare every Phase 6D migration with both approved Phase 6D specs
- inspect every `SECURITY DEFINER`, `search_path`, revoke, grant, function owner, FK, covering index, immutable binding, retry rule, cancellation check, and stored field
- prove `private.runtime_worker_tasks` stores no target URL, method, headers, body, credentials, or request plan
- prove `max_attempts = 1` cannot be bypassed by recovery
- prove cancellation is checked before preparation and again before publication
- prove service-role authority is RPC-scoped where intended instead of broad direct mutation

Then apply only the reviewed forward migrations, in order, to Supabase project:

`tdgpibrepzcvdivztkta`

After application:

- regenerate/reconcile TypeScript database types
- inspect migration history and live constraints/indexes/RLS/ACLs/function grants
- run Supabase security advisor and performance advisor
- repair live defects only with another forward migration

### 6. Phase 6D Task 15 - real Linux containment acceptance

This is a hard runtime-enable gate and cannot be satisfied by unit tests alone.

On a dedicated Linux worker host with rootless Podman and cgroup v2, prove:

- exact generated container command works
- executor direct DNS fails
- executor direct public TCP/HTTPS fails
- executor cannot reach supervisor/host services over loopback/TCP
- only the dedicated Unix mediator socket is usable
- arbitrary host Unix sockets are unavailable
- mediator can perform only the prepared authorized HTTPS operation
- private/loopback/reserved targets remain rejected
- active CORS makes exactly one request and the one-shot session cannot run again
- passive request/redirect budgets hold across the entire attempt
- cancellation stops mediator activity and late success is discarded
- memory, process, wall-time, and output ceilings are enforced
- mediator failure never causes direct-network fallback

Record OS, Podman version, cgroup mode, image digest, exact ScopeForge commit, and evidence in a Phase 6D acceptance document.

Neither Phase 6D production capability may be enabled before this evidence is reviewed.

### 7. Phase 6D Task 16 - implementation PR security review and disabled merge boundary

Before marking the future Phase 6D implementation PR ready:

- review every changed path for unrelated scope
- review all worker task/result contracts for authority expansion
- review every network import
- review every `SECURITY DEFINER` and privilege grant
- review cancellation, replay, lost-attempt, and one-shot semantics
- review logs/telemetry for target/secret leakage
- prove no direct-network fallback exists
- confirm GitHub Actions were not used and commits contain `[skip ci]`
- keep both Phase 6D production capabilities false after merge

Merge only with exact-head protection and fresh acceptance evidence for every executable gate. A disabled merge may precede real Linux acceptance, but runtime enablement may not.

### 8. Phase 8 validation methodology follow-on

Draft PR:

`#50 - Phase 8 validation methodology foundation [skip ci]`

The foundation document is intentionally incomplete. Remaining Phase 8 work includes:

- versioned labeled vulnerable labs
- machine-readable ground-truth manifests
- negative-control fixtures
- accuracy evaluator with rule-level TP/FP/FN reporting
- precision/recall/F1 only after a committed labeled corpus exists
- additional realistic performance fixtures
- justified regression thresholds rather than presenting the existing 20-second catastrophic ceiling as an SLO
- reproducibility metadata and artifact provenance
- public technical methodology/report output
- review and merge of PR #50 when its scope is ready

Do not invent unsupported accuracy claims before the corpus/evaluator exists.

### 9. Phase 7 Community Security Packs

Still unfinished. Preserve the existing product goal: community-extensible security knowledge without allowing packs to become arbitrary hosted code execution or generic network authority.

Before implementation, produce/approve the Phase 7 design covering at minimum:

- pack manifest/version/provenance model
- deterministic rule/policy boundaries
- signing/trust/review model as appropriate
- compatibility/versioning
- safe loading/execution model
- community contribution workflow
- protection against pack-supplied executable commands, arbitrary hosted networking, credentials, or unrestricted code execution

### 10. Phase 9 public-release hardening and operations

Still unfinished. It should follow the major runtime/community/methodology work and include at minimum:

- abuse/rate-limit policy for public trial use
- production capability enablement runbooks
- worker fleet operational monitoring
- incident/rollback procedures
- security logging/privacy review
- public authentication/bot-protection readiness, including truthful Turnstile status
- release documentation and support boundaries
- final threat-model reconciliation
- production smoke/rollback checks
- dependency/security advisories
- public-release acceptance evidence

Do not enable a capability merely because implementation code exists.

### 11. Documentation reconciliation after Phase 6D

`docs/development/CURRENT_STATE.md` still describes Phase 6D as design-gated because production/main has not accepted the implementation. After Phase 6D is reviewed/merged, reconcile CURRENT_STATE, TEST_STATUS, roadmap/status documents, and the Phase 6D plan checkboxes to the actual merged and deployed state. Do not update main-facing completion language early.

## Externally parked work - not part of the active queue while rate limits are in effect

These items are intentionally excluded from the active implementation queue so development time is not wasted polling metered services.

### Command center UI v4 - PR #49

PR #49 is parked behind Vercel's Free-plan deployment/build limits. The existing resume automation will recheck after the reset window and continue exact-head acceptance, normal-build restoration, PR review/merge, and production verification only when Vercel accepts builds again.

Do not spend active implementation time polling this PR while the rate limit remains authoritative.

### Phase 6D executable verification for stacked Tasks 4-9

The stacked Phase 6D source work must eventually receive fresh focused tests, full test suite, typecheck, CLI, benchmark, audit, and Next build evidence. External Vercel/Floot execution capacity has been rate-limited during implementation. Do not convert source review into a false 'green' claim.

When an independent runner becomes available, run the reviewed Phase 6D focused suites first, fix real compiler/test defects with TDD/systematic debugging, then run the full Task 14 acceptance chain on the exact candidate head.

### Temporary Floot operations helper cleanup

A temporary Floot production-operations helper was previously left pending deletion because of a Floot daily action cap. Stored credentials must not be deleted. Clean up the temporary helper only after the relevant Floot quota is available and the helper identity is proven.

## Resume order

Unless a new blocker or security finding changes the dependency graph, resume in this order:

1. Finish Task 9 source hardening.
2. Implement Task 10 hosted action cutover with no fallback.
3. Implement Task 11 backpressure/fleet/recovery.
4. Implement Task 12 architecture guards.
5. Perform Task 13 SQL source review and Supabase reconciliation.
6. Run Task 14 software acceptance when an execution runner is available.
7. Perform Task 15 real Linux containment acceptance before any runtime enablement.
8. Perform Task 16 PR security review and merge disabled.
9. Continue Phase 8 methodology/evaluator work and reconcile PR #50.
10. Design and implement Phase 7 Community Security Packs.
11. Complete Phase 9 public-release hardening/operations.
12. Reconcile repository status documentation to the final accepted state.

Rate-limit-only work remains parked and should resume through its existing scheduled/availability path rather than interrupting this active queue.
