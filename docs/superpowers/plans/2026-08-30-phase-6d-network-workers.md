# Phase 6D Dedicated Network Workers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing passive runtime observation and bounded active CORS validation paths behind two closed, lease-bound, mediator-enforced worker classes without widening network authority.

**Architecture:** The Vercel control plane remains authoritative for enqueue authorization, current-asset reauthorization, cancellation, deterministic rule evaluation, and canonical persistence. A claimed worker attempt receives no target URL. It must obtain a short-lived preparation profile bound to the exact task, attempt, class, lease, domain job, asset snapshot, and deadline. The executor process has `--network=none` and can communicate only over a Unix-domain socket with a supervisor-owned runtime network mediator. The mediator owns the prepared profile and all external DNS, TCP, TLS, and HTTP. The executor can request only `run passive` or `run active CORS` for its opaque session identity. The mediator invokes the existing Phase 4 observer/validator with the existing pinned HTTPS transport and returns normalized observations only. Dedicated trusted publication then rechecks cancellation and persists through the existing repositories and deterministic rule engines. There is no generic URL/fetch/proxy surface.

**Tech Stack:** Next.js 15.5.24, TypeScript 5.8.3, Vitest 3.2.0, Supabase/PostgreSQL, Node.js HTTPS/TLS/DNS primitives already present in `packages/runtime-network`, existing ScopeForge worker broker/supervisor, rootless Podman command contracts for Linux containment.

**Specs:**

- `docs/superpowers/specs/2026-08-30-phase-6d-network-workers-design.md`
- `docs/superpowers/specs/2026-08-30-phase-6d-network-worker-containment-addendum.md`

## Execution rules

- [ ] Do not trigger, rerun, or depend on GitHub Actions.
- [ ] Every implementation/documentation commit contains `[skip ci]`.
- [ ] Use TDD for every behavior change. Prove the intended failure before implementation whenever an executable test runner is available.
- [ ] Never claim tests, typecheck, build, audit, database, sandbox, or runtime gates are green unless they actually run and their output is inspected.
- [ ] Existing deployed migrations are immutable. Phase 6D database work is forward-only.
- [ ] Add no new npm runtime dependencies unless a separately reviewed requirement makes one unavoidable. The current design requires none.
- [ ] Keep `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED=false` and `HOSTED_ACTIVE_CORS_WORKER_ENABLED=false` in every deployed environment during implementation.
- [ ] Do not enable Phase 6B or Phase 6C runtime gates as part of Phase 6D.
- [ ] Do not add a generic URL, HTTP request, proxy, browser automation, port scanning, arbitrary header/body, authentication replay, or unrestricted network interface.
- [ ] The executor process must have no raw external egress. Only the mediator may import Phase 6D network primitives or own external sockets.
- [ ] Network workers never receive Supabase `service_role`, browser/user tokens, arbitrary database credentials, R2 authority, or the Phase 6B GitHub network policy.
- [ ] Network workers never create canonical findings directly. Rule evaluation and persistence stay in the trusted control plane.
- [ ] Phase 6D network tasks use `max_attempts = 1`. A lost or ambiguous attempt must not automatically replay remote network activity.
- [ ] At most one live Phase 6D network task may exist per workspace. Do not add a new daily public quota while the runtime gates are false; Phase 9 abuse policy can tighten public limits before enablement.
- [ ] A disabled capability gate must fail before creating a dead worker task. There is no automatic fallback to direct Vercel networking after cutover.

## Task 1 - Lock the two closed worker contracts

### Tests first

- [ ] Create `tests/workers/runtime-network-contracts.test.ts`.
- [ ] Extend `tests/workers/contracts.test.ts` only where existing union exhaustiveness requires it.
- [ ] Assert the only new execution classes are `passive_runtime_observation_v1` and `active_cors_validation_v1`.
- [ ] Assert the only new network-policy identifiers are class-specific, never `network`, `http`, `fetch`, or `proxy` generic policies.
- [ ] Assert passive supervisor limits are exactly: wall 30000 ms, CPU 15000 ms, memory 268435456 bytes, processes 1, input files 0, input bytes 65536, scratch 16777216, output 131072.
- [ ] Assert active supervisor limits are exactly: wall 20000 ms, CPU 10000 ms, memory 268435456 bytes, processes 1, input files 0, input bytes 32768, scratch 8388608, output 65536.
- [ ] Assert claimed task input contains only the domain job reference and class-specific kind. It must not contain canonical URL, hostname, IP, method, headers, body, redirect policy, budget overrides, credentials, or authorization snapshots.
- [ ] Assert successful passive terminal result contains only normalized `RuntimeObservation[]`, requestCount, redirectCount, and stable result metadata.
- [ ] Assert successful active terminal result contains only one normalized `CorsPolicyObservation`, requestCount = 1, and stable result metadata.
- [ ] Assert closed Phase 6D failure-code sets.

Expected focused command when executable:

```text
npx vitest run tests/workers/runtime-network-contracts.test.ts tests/workers/contracts.test.ts
```

### Implementation

- [ ] Modify `packages/worker-contracts/types.ts`.
- [ ] Modify `packages/worker-contracts/profiles.ts`.
- [ ] Modify `packages/worker-contracts/validation.ts`.
- [ ] Modify `packages/worker-contracts/index.ts` only if new exported helpers are needed.
- [ ] Keep all switches exhaustive.

Commit:

```text
feat: define Phase 6D worker contracts [skip ci]
```

## Task 2 - Add forward-only Phase 6D worker-task binding schema

### Tests first

- [ ] Create `tests/runtime-workers/migration.test.ts`.
- [ ] Create `tests/runtime-workers/control-migration.test.ts`.
- [ ] Assert the forward migration widens private worker-node/task class checks to exactly the existing three classes plus the two Phase 6D classes.
- [ ] Assert public `scan_job_kind` is not widened because Phase 6D reuses existing `passive_runtime` and `active_validation` domain jobs.
- [ ] Assert a private `runtime_worker_tasks` table binds `task_id`, `scan_job_id`, `workspace_id`, `asset_id`, `requested_by`, `domain_job_kind`, and schema version without storing a URL or request configuration.
- [ ] Assert one worker task per domain job and composite FK identity against `scan_jobs`.
- [ ] Assert `passive_runtime_observation_v1` can bind only a `passive_runtime` job and `active_cors_validation_v1` only an `active_validation` job.
- [ ] Assert Phase 6D task rows are private and not selectable/mutable by anon/authenticated roles.
- [ ] Assert every new FK has a covering index.
- [ ] Assert task `max_attempts = 1` and absolute deadlines are 30 seconds passive / 20 seconds active.
- [ ] Assert enqueue refuses a second queued/leased/retry Phase 6D task in the same workspace.

### Implementation

Add forward migrations after the existing Phase 6C set, using fresh timestamps, for example:

- [ ] `supabase/migrations/20260831010000_phase_6d_runtime_worker_schema.sql`
- [ ] `supabase/migrations/20260831010100_phase_6d_runtime_worker_control.sql`
- [ ] `supabase/migrations/20260831010200_phase_6d_runtime_worker_fk_indexes.sql`

The SQL should add dedicated registration and claim functions rather than turning the generic worker claim path into arbitrary network authority:

- [ ] `register_passive_runtime_worker_node`
- [ ] `register_active_cors_worker_node`
- [ ] `enqueue_passive_runtime_worker_task`
- [ ] `enqueue_active_cors_worker_task`
- [ ] `claim_runtime_worker_task`
- [ ] lease-bound runtime preparation-context RPC used by Task 4

Do not apply these migrations to production yet.

Commit:

```text
feat: add Phase 6D worker queue schema [skip ci]
```

## Task 3 - Add independent hard-false capabilities and worker enqueue bridge

### Tests first

- [ ] Create `tests/runtime-workers/capabilities.test.ts`.
- [ ] Create `tests/runtime-workers/enqueue.test.ts`.
- [ ] Assert absent/false/invalid env values make both capabilities false.
- [ ] Assert passive and active flags are independent.
- [ ] Assert a false gate prevents worker task enqueue.
- [ ] Assert the worker-enqueue bridge accepts an already-authorized domain job identity, not caller URL/request configuration.
- [ ] Assert wrong job-kind/class pairing is rejected.
- [ ] Assert no direct network execution occurs in the bridge.

### Implementation

- [ ] Add `lib/runtime-workers/capabilities.ts`.
- [ ] Add `lib/runtime-workers/errors.ts` with safe closed error codes such as `RUNTIME_WORKER_UNAVAILABLE`, `RUNTIME_WORKER_BUSY`, and `RUNTIME_WORKER_TASK_INVALID`.
- [ ] Add `lib/runtime-workers/enqueue.ts`.
- [ ] Extend `lib/worker-control/types.ts`, `repository.ts`, and `service.ts` with explicit Phase 6D registration/claim paths.
- [ ] Keep both new environment variables unset/false in Vercel.

Commit:

```text
feat: gate Phase 6D runtime worker enqueue [skip ci]
```

## Task 4 - Implement lease-bound preparation with immediate Phase 4 reauthorization

### Tests first

- [ ] Create `tests/runtime-workers/preparation.test.ts`.
- [ ] Create `tests/runtime-workers/preparation-route.test.ts`.
- [ ] Assert the route requires the normal worker credential plus exact taskId, attemptId, and leaseToken.
- [ ] Assert the browser cannot call it as an authenticated-user API.
- [ ] Assert the request body has no URL, hostname, method, headers, body, profile, budget, workspace, asset, or actor fields.
- [ ] Assert the private RPC derives the domain job binding from `runtime_worker_tasks`.
- [ ] Assert passive preparation calls `reauthorizeRuntimeObservationExecution` against the current asset.
- [ ] Assert active preparation calls `reauthorizeActiveValidationExecution`, preserving owner/admin explicit-consent snapshot requirements already stored on the job.
- [ ] Assert changed verification timestamp, canonical target, asset kind, unverified asset, cancellation, wrong job status, wrong class, stale lease, or expired deadline fail before mediator session creation.
- [ ] Assert the preparation profile expires no later than the worker attempt absolute deadline.
- [ ] Assert the prepared passive budget cannot exceed Phase 4 passive maxima.
- [ ] Assert active budget must equal the existing exact CORS budget.

### Implementation

- [ ] Add `lib/runtime-workers/preparation.ts`.
- [ ] Add `lib/runtime-workers/types.ts` for trusted prepared-profile types.
- [ ] Add `lib/runtime-workers/server-dependencies.ts` if this keeps admin/loadAsset composition isolated.
- [ ] Add `app/api/internal/workers/runtime/prepare/route.ts`.
- [ ] Add a worker-control repository method for the exact lease-bound preparation context.
- [ ] Do not serialize user/session credentials into the preparation response.

Commit:

```text
feat: reauthorize runtime workers before network execution [skip ci]
```

## Task 5 - Define the mediator protocol with no caller-controlled network fields

### Tests first

- [ ] Create `tests/runtime-worker-mediator/protocol.test.ts`.
- [ ] Assert the executor-facing request is only an opaque session identity plus operation `run`.
- [ ] Assert the passive run operation contains no URL/method/header/body/redirect fields.
- [ ] Assert the active run operation contains no URL/method/header/body/origin/user-agent/accept/port/redirect fields.
- [ ] Assert session identity is task + attempt + execution class + random session nonce and is single-attempt scoped.
- [ ] Assert raw response bodies and raw unrestricted header maps are not valid mediator results.
- [ ] Assert terminal result size is independently bounded.

### Implementation

Add a focused package:

- [ ] `packages/runtime-worker-mediator/contracts.ts`
- [ ] `packages/runtime-worker-mediator/validation.ts`
- [ ] `packages/runtime-worker-mediator/session-registry.ts`
- [ ] `packages/runtime-worker-mediator/index.ts`

The supervisor registers the prepared profile directly with the mediator. The executor receives only an opaque session handle. The executor cannot register or mutate profiles.

Commit:

```text
feat: add closed runtime mediator protocol [skip ci]
```

## Task 6 - Implement mediator-owned passive and active execution

### Tests first

- [ ] Create `tests/runtime-worker-mediator/passive.test.ts`.
- [ ] Create `tests/runtime-worker-mediator/active-cors.test.ts`.
- [ ] Create `tests/runtime-worker-mediator/privacy.test.ts`.
- [ ] Test passive max 4 requests / 3 redirects / 15 seconds / 65536 observation bytes.
- [ ] Test active exactly one GET / zero redirects / 10 seconds / 32768 observation bytes.
- [ ] Test active request plan remains exact port 443, synthetic Origin, fixed user-agent, fixed Accept, no body/credentials.
- [ ] Test passive redirect policy remains the existing `validateRedirectTarget` behavior.
- [ ] Test private/reserved/loopback/link-local destinations fail through existing pinned HTTPS safety.
- [ ] Test DNS rebinding/pinning behavior remains covered by existing runtime-network tests.
- [ ] Test cancellation before network results in zero requests.
- [ ] Test cancellation between passive requests stops subsequent requests.
- [ ] Test cancellation after active request prevents result publication but cannot send a second request.
- [ ] Test mediator result contains only normalized observations and counters, never response body, raw Set-Cookie values, Authorization, Proxy-Authorization, resolver transcripts, or raw remote exception strings.
- [ ] Test a reused/expired/wrong-class/wrong-attempt session is rejected.

### Implementation

- [ ] Add `packages/runtime-worker-mediator/passive.ts`.
- [ ] Add `packages/runtime-worker-mediator/active-cors.ts`.
- [ ] Add `packages/runtime-worker-mediator/service.ts`.
- [ ] The mediator may import `packages/runtime-network`, `packages/runtime-observer`, and `packages/runtime-validator`.
- [ ] Invoke existing `observeRuntimeTarget` and `validateCorsOriginPolicy` inside the mediator with the existing pinned HTTPS transport and mediator-owned cancellation callback.
- [ ] Keep raw network response metadata inside the mediator process. Return only the existing normalized Phase 4 observation types.

Commit:

```text
feat: execute closed runtime profiles in mediator [skip ci]
```

## Task 7 - Add Unix-domain-socket transport and networkless executor sandbox contract

### Tests first

- [ ] Create `tests/runtime-worker-mediator/unix-socket.test.ts`.
- [ ] Create `tests/runtime-worker-sandbox/podman-command.test.ts`.
- [ ] Create `tests/runtime-worker-sandbox/architecture.test.ts`.
- [ ] Assert bounded length-prefixed JSON framing over a Unix-domain socket.
- [ ] Assert peer messages are strict-schema and over-size frames are rejected before allocation/parse.
- [ ] Assert session nonce is never logged.
- [ ] Assert executor Podman command contains `--network=none`, `--read-only`, `--cap-drop=all`, `--security-opt=no-new-privileges`, the Task 15 measured cgroup task/thread ceiling `--pids-limit=8`, memory 256 MiB, no registry pull, no privileged/device/host socket mounts, and no shell-composed arguments. The executor still receives no general process-spawn authority from ScopeForge.
- [ ] Assert only the dedicated mediator Unix socket is bind-mounted read-only for IPC.
- [ ] Assert no TCP localhost dependency is required because `--network=none` must remain valid.
- [ ] Assert caller/task fields cannot inject Podman arguments or socket paths.

### Implementation

- [ ] Add `packages/runtime-worker-mediator/unix-server.ts`.
- [ ] Add `packages/runtime-worker-mediator/unix-client.ts`.
- [ ] Add `packages/runtime-worker-sandbox/types.ts`.
- [ ] Add `packages/runtime-worker-sandbox/podman-command.ts`.
- [ ] Add `packages/runtime-worker-sandbox/index.ts`.
- [ ] Use a fixed supervisor-owned socket root and per-attempt opaque socket filename.
- [ ] The executor container receives the socket mount but no host networking.

Commit:

```text
security: contain Phase 6D executor networking [skip ci]
```

## Task 8 - Integrate the two classes into the worker supervisor

### Tests first

- [ ] Extend `tests/workers/supervisor.test.ts`.
- [ ] Create `tests/runtime-workers/supervisor.test.ts`.
- [ ] Create `tests/runtime-workers/executor-architecture.test.ts`.
- [ ] Assert Phase 6D claims are prepared before executor start.
- [ ] Assert lease token stays supervisor/control-client side and never enters executor input.
- [ ] Assert prepared target/profile stays supervisor/mediator side and never enters executor input.
- [ ] Assert the executor receives only class, deadline, resource budget, domain job reference, and opaque mediator session/socket data required to run the fixed class operation.
- [ ] Assert executor source does not import `node:http`, `node:https`, `node:net`, `node:tls`, `node:dns`, `packages/runtime-network`, or low-level request helpers.
- [ ] Assert control loss, deadline, or cancellation aborts mediator work and terminates executor.
- [ ] Assert generic worker success finalization rejects both Phase 6D success classes.
- [ ] Assert `max_attempts=1` means lost/expired Phase 6D tasks never requeue automatically.

### Implementation

- [ ] Modify `packages/worker-supervisor/control-client.ts` with `runtimePrepare` and `runtimeFinalize` operations.
- [ ] Modify `packages/worker-supervisor/executor.ts` with explicit passive and active dispatchers.
- [ ] Add `packages/worker-supervisor/runtime-network.ts` for supervisor-owned preparation/mediator lifecycle.
- [ ] Modify `packages/worker-supervisor/supervisor.ts`.
- [ ] Modify `packages/worker-supervisor/index.ts`.
- [ ] Extend worker-control service/repository class dispatch without turning the generic path into a network policy oracle.

Commit:

```text
feat: supervise isolated Phase 6D runtime workers [skip ci]
```

## Task 9 - Add dedicated trusted result validation and publication

### Tests first

- [ ] Create `tests/runtime-workers/result-validation.test.ts`.
- [ ] Create `tests/runtime-workers/publication.test.ts`.
- [ ] Create `tests/runtime-workers/finalize-route.test.ts`.
- [ ] Assert exact task/attempt/lease/class binding before accepting terminal data.
- [ ] Assert successful passive output is revalidated against the passive observation schema, count limits, redirect limits, and max observation bytes.
- [ ] Assert active output is exactly one `cors-policy` observation and requestCount = 1.
- [ ] Assert cancellation is rechecked immediately before persistence and wins over a late success.
- [ ] Assert passive success runs existing `evaluateRuntimeRules`, evidence mapper, finding mapper, and `RuntimeObservationRepository.persistResult`.
- [ ] Assert active success runs existing `evaluateCorsPolicyRules`, mappers, and `ActiveValidationRepository.persistResult`.
- [ ] Assert workers never submit canonical findings/evidence.
- [ ] Assert malformed/over-budget terminal output inserts no observations/findings and produces a closed failure.
- [ ] Assert raw worker/remote error text never becomes a public failure message.
- [ ] Assert replay/conflicting terminal behavior is deterministic and does not duplicate findings.

### Implementation

- [ ] Add `lib/runtime-workers/result-validation.ts`.
- [ ] Add `lib/runtime-workers/publication.ts` or split into `passive-publication.ts` and `active-publication.ts` if that keeps authority clearer.
- [ ] Add `app/api/internal/workers/runtime/finalize/route.ts`.
- [ ] Add forward publication RPC migration only if atomic task-attempt/domain-job transitions cannot be safely achieved with existing RPCs. Prefer reusing existing domain persistence RPCs plus a narrow worker-attempt finalize RPC.
- [ ] Keep worker failure/cancel finalization class-specific as well, so generic finalization cannot accidentally define Phase 6D domain semantics.

Commit:

```text
feat: publish Phase 6D runtime results safely [skip ci]
```

## Task 10 - Cut the dashboard actions over to queued worker execution with no direct fallback

### Tests first

- [ ] Extend `tests/runtime-validator/action-boundary.test.ts`.
- [ ] Create `tests/runtime-observations/action-boundary.test.ts`.
- [ ] Extend `tests/runtime-observations/service.test.ts` and `tests/runtime-validator/service.test.ts` to preserve direct service behavior only as unit-testable domain logic, not the hosted dashboard execution path.
- [ ] Assert `runPassiveRuntimeObservation` never calls `executeRuntimeObservation` directly after cutover.
- [ ] Assert `runCorsOriginPolicyValidation` never calls `executeActiveValidation` directly after cutover.
- [ ] Assert server actions still accept only asset ID, plus explicitConsent boolean for active CORS.
- [ ] Assert no URL/header/method/profile/budget/worker/class fields can enter through the browser action.
- [ ] Assert false capability returns a truthful `RUNTIME_WORKER_UNAVAILABLE` response before creating a queued domain/worker job.
- [ ] Assert there is no `if worker unavailable then execute directly` path.
- [ ] Assert cancellation still scopes by job ID and propagates to the worker task/mediator through trusted control state.

### Implementation

- [ ] Add high-level request functions in `lib/runtime-workers/request.ts` that perform existing enqueue authorization and atomically queue the corresponding worker task when capability is enabled.
- [ ] Modify `app/dashboard/assets/[assetId]/runtime-actions.ts`.
- [ ] Modify `app/dashboard/assets/[assetId]/active-validation-actions.ts`.
- [ ] Modify the asset detail read model/UI only as needed to show queued/running/unavailable truthfully.
- [ ] Do not enable either capability flag.

Commit:

```text
feat: route hosted runtime actions through workers [skip ci]
```

## Task 11 - Add queue backpressure, fleet health, and cancellation recovery

### Tests first

- [ ] Create `tests/runtime-workers/backpressure.test.ts`.
- [ ] Create `tests/runtime-workers/fleet.test.ts`.
- [ ] Extend `tests/workers/service.test.ts` and migration tests.
- [ ] Assert one live Phase 6D task per workspace across both network classes.
- [ ] Assert passive and active workers claim only their exact class.
- [ ] Assert passive fleet leased concurrency cap is 2 and active cap is 1 at the Phase 6D claim layer.
- [ ] Assert the existing overall worker leased cap remains an additional ceiling, not bypassed.
- [ ] Assert cancelled queued task becomes terminal without mediator start.
- [ ] Assert a leased cancellation prevents success publication.
- [ ] Assert expired/lost Phase 6D attempt does not requeue because `max_attempts=1`.
- [ ] Assert fleet health exposes class availability/saturation only, not target identity or response data.

### Implementation

- [ ] Add class-specific backpressure in the Phase 6D claim/enqueue SQL and worker-control read model.
- [ ] Extend `lib/worker-control/fleet.ts` with safe Phase 6D class counts if needed.
- [ ] Reuse the existing worker heartbeat/lost-attempt machinery, but make Phase 6D recovery terminal rather than retrying.
- [ ] Do not add new public daily quota values in this phase.

Commit:

```text
security: enforce Phase 6D worker backpressure [skip ci]
```

## Task 12 - Add permanent authority and import-graph guards

### Tests first

- [ ] Create `tests/architecture/phase6d-runtime-workers.test.ts`.
- [ ] Extend existing Phase 6B/6C worker architecture guards.
- [ ] Assert only `packages/runtime-worker-mediator/**` and existing `packages/runtime-network/**` may own Phase 6D external network imports.
- [ ] Assert `packages/worker-supervisor` executor implementations do not import raw network modules or runtime-network.
- [ ] Assert dashboard/server actions do not import runtime-network or mediator internals.
- [ ] Assert mediator does not import Supabase/admin/database repositories.
- [ ] Assert mediator does not import R2, GitHub acquisition, scanner runner, model providers, browser automation, child-process, VM, or worker-thread modules.
- [ ] Assert Phase 6B GitHub acquisition does not import the Phase 6D mediator.
- [ ] Assert Phase 6C zero-egress scanner does not import the mediator or runtime network.
- [ ] Assert no class named or shaped as generic URL/fetch/http/proxy appears in worker-contract public unions.
- [ ] Assert the executor sandbox command permanently includes `--network=none`.

### Implementation

- [ ] Add only the minimum refactors required for the guards to pass.
- [ ] Do not weaken a guard to accommodate a convenience import. Move authority to the correct package instead.

Commit:

```text
security: lock Phase 6D authority boundaries [skip ci]
```

## Task 13 - Source review and Supabase reconciliation

Before applying SQL:

- [ ] Compare every new migration against both approved Phase 6D specs.
- [ ] Confirm all `SECURITY DEFINER` functions use `set search_path = ''`.
- [ ] Confirm explicit revokes/grants and no browser role can call private runtime-worker helpers directly.
- [ ] Confirm no service-role direct table mutation is granted where RPC-only authority is intended.
- [ ] Confirm exact composite FKs and covering indexes.
- [ ] Confirm class/job-kind binding cannot be changed after task creation.
- [ ] Confirm `max_attempts=1` cannot be bypassed by recovery.
- [ ] Confirm cancellation is checked before preparation and publication.
- [ ] Confirm no migration stores target URL/method/headers in `private.runtime_worker_tasks`.

Then, and only then:

- [ ] Apply reviewed forward migrations to Supabase project `tdgpibrepzcvdivztkta` in order.
- [ ] Regenerate/reconcile database TypeScript types.
- [ ] Inspect migration history, constraints, indexes, RLS, ACLs, function owners/security/search_path/execute grants.
- [ ] Run Supabase security advisor and performance advisor.
- [ ] Fix any live defect only with another forward migration.

Commit any generated types/live hardening as:

```text
fix: reconcile Phase 6D database authority [skip ci]
```

## Task 14 - Full software acceptance while runtime gates stay false

When a test runner is available, run the full chain on the exact candidate head:

```text
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js --version
npm run benchmark:scanner
npm audit --audit-level=info
npm run build
```

Also verify:

- [ ] no new npm dependencies or lockfile drift unless separately reviewed
- [ ] both Phase 6D environment capability gates are false/absent
- [ ] both Phase 6B/6C hosted runtime gates remain false
- [ ] Turnstile is not claimed active
- [ ] direct dashboard runtime actions cannot invoke network execution in Vercel
- [ ] generic worker finalize rejects Phase 6D success
- [ ] dedicated finalize is cancellation-first
- [ ] current Phase 4 deterministic findings/evidence behavior remains compatible
- [ ] scanner benchmark remains within its existing catastrophic ceiling

Do not use Vercel as the primary test runner while the 100-deploy/24-hour free-plan cap is active. Wait for the existing scheduled Vercel resume flow for deployment-dependent checks.

## Task 15 - Real Linux containment acceptance before any runtime enablement

This is a hard production gate and cannot be simulated by unit tests alone.

On a dedicated Linux worker host with rootless Podman and cgroup v2:

- [ ] Confirm rootless Podman and cgroup-v2 support.
- [ ] Launch the executor with the exact generated command.
- [ ] Prove direct DNS lookup from executor fails.
- [ ] Prove direct TCP/HTTPS to a public test endpoint from executor fails.
- [ ] Prove loopback/TCP access to supervisor/host services is unavailable.
- [ ] Prove the mounted Unix mediator socket remains usable.
- [ ] Prove arbitrary Unix sockets are not exposed.
- [ ] Prove the mediator can complete an authorized HTTPS request only through the prepared session.
- [ ] Prove private/loopback/reserved target resolution is rejected.
- [ ] Prove active CORS makes exactly one request and cannot make a second request with the same session.
- [ ] Prove passive request/redirect budgets are enforced across the complete attempt.
- [ ] Prove cancellation kills/aborts mediator activity and late success is discarded.
- [ ] Prove memory, process, wall-time, and output ceilings are enforced.
- [ ] Prove mediator failure does not cause direct-network fallback.

Record worker OS, Podman version, cgroup mode, exact image digest, exact ScopeForge commit, and test evidence in a Phase 6D acceptance document.

Neither production capability flag may be changed from false until this gate passes and is reviewed.

## Task 16 - PR security review and release boundary

Before marking the implementation PR ready:

- [ ] Review every changed path and confirm no unrelated UI/Phase 7/Phase 8 work is mixed into the Phase 6D implementation branch.
- [ ] Review worker contract/task/result schemas for authority expansion.
- [ ] Review every network import.
- [ ] Review every `SECURITY DEFINER` function and privilege grant.
- [ ] Review cancellation and replay behavior.
- [ ] Review logs/telemetry for secret/target-data leakage.
- [ ] Review capability checks and prove no direct-network fallback.
- [ ] Confirm all commits contain `[skip ci]` and GitHub Actions were not used.
- [ ] Keep production gates false even after merge.

Merge only with exact-head protection after the software acceptance gates that are executable in the current environment are fresh and green. Phase 6D can merge disabled before real worker-host acceptance, but hosted passive/active execution must remain unavailable until Task 15 passes.

## Implementation ordering rationale

The order deliberately establishes authority boundaries before execution code:

1. closed contracts
2. private task binding
3. hard-false capabilities
4. fresh reauthorization
5. closed mediator protocol
6. mediator network implementation
7. OS/process containment
8. supervisor integration
9. trusted publication
10. public action cutover
11. backpressure/recovery
12. permanent architecture guards
13. database reconciliation
14. software acceptance
15. real containment acceptance
16. release review

This prevents the project from temporarily containing a reusable network executor while later tasks are still incomplete.
