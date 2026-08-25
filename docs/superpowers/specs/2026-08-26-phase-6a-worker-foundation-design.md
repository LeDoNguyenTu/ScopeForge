# Phase 6A Durable Worker Foundation Design

Date: 2026-08-26
Status: proposed design for user review
Scope: durable queue/lease/cancellation/isolation foundation only
Base: `main` at `9cd4ab5772e4841d2c60b11b73fad2bbd0db4ffc`

## 1. Goal

Phase 6A establishes a production-shaped execution control plane for ScopeForge without yet enabling hosted repository acquisition or new target-network authority.

The slice creates the durable task, worker identity, lease, retry, cancellation, resource-budget, and isolation contracts that later Phase 6 slices can use for offline repository scanning and the already-approved runtime executors.

Phase 6A is intentionally not user-facing. The existing trial setting `concurrentScanJobsPerWorkspace: 0` remains unchanged. No browser action will gain the ability to start a hosted worker job in this slice.

The core invariant is:

> A hostile repository, authenticated user, stale worker, duplicated delivery, or compromised executor must not be able to choose what command runs, widen network authority, cross workspace boundaries, commit stale results, or acquire ScopeForge control-plane credentials.

## 2. Existing architecture that must be preserved

ScopeForge already has a strong job and evidence model:

- `scan_jobs` is the canonical product-visible job record.
- runtime enqueue captures immutable authorization snapshots and bounded budgets.
- passive and active execution re-authorize immediately before execution.
- cancellation is represented by `cancel_requested_at` and terminal state transitions are guarded in PostgreSQL.
- runtime result persistence is atomic and rejects late cancellation/result races.
- Phase 3 repository scanning is passive with respect to target code: it reads hostile repository content but does not execute target modules, lifecycle scripts, Dockerfiles, Terraform, Kubernetes, GitHub Actions, or package managers.
- Phase 5C already proves that hosted static findings can be admitted without granting repository execution or runtime networking to the control plane.
- browser roles remain read-only for hosted security state and trusted mutation paths are narrow.

Today the application service still performs runtime execution directly after enqueue. Phase 6 must move execution behind a durable claim/lease boundary rather than turning the application process into a larger scanner host.

## 3. Phase decomposition

Phase 6 is too large to implement safely as one change. It is split into separately reviewed boundaries:

### Phase 6A - this spec

- authoritative durable worker queue state
- worker registration and identity
- atomic claim/lease protocol
- heartbeat and bounded lease extension
- retry and dead-letter semantics
- cancellation propagation and race rules
- resource-budget contract
- sandbox/executor interface with zero target egress
- worker/control-plane credential separation
- audit and fleet read models
- executable architecture guards

No product job kind is switched to worker execution yet.

### Phase 6B - later design

- private content-addressed input artifacts
- retention and deletion
- artifact integrity verification
- isolated offline Phase 3 scanning from a pre-staged artifact
- canonical Phase 3 result admission from workers

### Phase 6C - later design

- repository acquisition/integration policy
- tightly scoped source-provider credentials if needed
- acquisition egress separated from scanner egress
- repository identity/ref/commit binding

### Phase 6D - later design

- move existing passive runtime and `cors-origin-policy@1` active execution into dedicated network-enabled worker classes
- preserve their current target authorization, DNS/IP safety, request shapes, consent, budgets, and persistence semantics

### Phase 6E - later design

- fleet scaling, provider-specific autoscaling, richer operational dashboards, abuse controls, cost controls, and public production hardening

## 4. Approaches considered

### A. PostgreSQL-authoritative task queue with leases - recommended

PostgreSQL remains the source of truth for execution eligibility, lease ownership, cancellation, retries, and terminalization. Workers claim tasks through narrow trusted RPCs using `FOR UPDATE SKIP LOCKED` semantics. A future external queue may wake workers, but it never becomes authoritative.

Benefits:

- cancellation and job state remain transactionally close to existing `scan_jobs`
- no dual-source-of-truth problem between a queue vendor and Supabase
- simple idempotency and stale-worker rejection
- provider-neutral worker fleet
- easy deterministic testing of races

Trade-off: polling or wake-up hints are less throughput-efficient than using an external queue as sole authority. That is acceptable for the first safe worker boundary and can be optimized later without changing correctness semantics.

### B. External queue as authority

A managed queue would deliver messages directly to workers and PostgreSQL would record job state afterward.

Rejected for 6A because at-least-once delivery plus a second authoritative state machine makes cancellation, replay, retry, and result races harder to reason about. A managed queue can be added later as a non-authoritative delivery hint.

### C. Continue executing inside Vercel/control-plane requests or cron

Rejected. It does not create the required isolation boundary, couples user request handling to scanner resource use, and would make future hostile-repository execution risk materially worse.

## 5. Trust zones

Phase 6A defines four trust zones.

### Browser/user zone

May request only already-approved product actions. It never receives worker credentials, lease tokens, provider credentials, arbitrary command/config fields, or direct access to worker tables/RPCs.

### Control-plane/broker zone

Trusted to authenticate users, create approved product jobs, and broker worker control messages. It may hold Supabase service-role credentials. It must expose only a closed worker API and must never copy service-role credentials into a worker.

### Worker supervisor zone

Trusted only for task orchestration. It receives a scoped worker credential, task identity, immutable execution contract, and artifact references. It owns heartbeat, cancellation polling, sandbox lifecycle, bounded output collection, and result submission.

The supervisor must not receive the Supabase service-role key or general control-plane credentials.

### Executor sandbox zone

Treat as potentially compromised by hostile repository content. It receives only the minimum input required to execute one approved scanner contract.

It must have:

- no target/network egress in Phase 6A
- no control-plane credentials
- no worker broker credential
- no cloud-provider metadata access
- no host filesystem access outside mounted inputs/scratch
- no Docker/container runtime socket
- no privileged mode
- non-root execution
- fixed scanner executable/image selected by ScopeForge, never by the caller
- bounded CPU, memory, process count, wall time, file count, input bytes, output bytes, and scratch bytes
- ephemeral writable storage destroyed after the attempt

## 6. Authoritative data model

`scan_jobs` remains the only product-visible job lifecycle. Worker scheduling state must not become a second product lifecycle.

Phase 6A adds internal execution tables. They should live in the `private` schema where possible and receive no browser privileges.

### `private.worker_tasks`

One current scheduling row per worker-enabled `scan_job`.

Proposed fields:

- `id uuid primary key`
- `scan_job_id uuid unique not null`
- `workspace_id uuid not null`
- `asset_id uuid not null`
- `execution_class text not null`
- `state text not null` limited to `queued | leased | retry_wait | completed | dead_letter | cancelled`
- `priority smallint not null default 0`
- `available_at timestamptz not null`
- `attempt_count integer not null default 0`
- `max_attempts integer not null default 3`
- `absolute_deadline_at timestamptz not null`
- `created_at`, `updated_at`

The task row contains no command string, arbitrary environment variables, arbitrary container/image reference, caller URL, headers, body, repository checkout command, package-manager options, or generic network policy.

`execution_class` is a closed server-defined enum/constraint. In 6A the only enabled class is an internal no-egress contract used to prove the worker foundation. Product job kinds are not switched over yet.

### `private.worker_attempts`

Append-oriented attempt history:

- `id uuid primary key`
- `task_id uuid not null`
- `attempt_number integer not null`
- `worker_id uuid not null`
- `lease_token_hash text not null`
- `leased_at timestamptz not null`
- `lease_expires_at timestamptz not null`
- `last_heartbeat_at timestamptz`
- `finished_at timestamptz`
- `outcome text` limited to `succeeded | failed | cancelled | lease_expired | worker_lost`
- bounded `failure_code`
- bounded resource metrics such as wall time, peak memory, CPU time, input/output byte counts

A unique `(task_id, attempt_number)` prevents duplicate attempt numbering.

### `private.worker_nodes`

Fleet identity and health:

- generated worker ID
- immutable execution class/capability snapshot
- software/build version
- registered timestamp
- last heartbeat timestamp
- disabled/revoked timestamp

Do not store reusable plaintext worker secrets in the database. Store hashes or credential identifiers only.

## 7. Worker authentication

Workers must never receive the Supabase `service_role` key.

Recommended 6A pattern:

1. a worker is provisioned with a scoped broker credential or bootstrap secret
2. the control-plane worker gateway authenticates that worker
3. the gateway uses its own trusted database client to call narrow service-role-only worker RPCs
4. the worker can only perform claim, heartbeat, cancellation check, and finalization through that gateway

The worker-facing credential should be independently revocable and rotated without rotating application database credentials.

The browser cannot call worker gateway operations because worker authentication is distinct from user authentication.

A future mTLS or provider workload-identity mechanism may replace bearer credentials without changing the database lease protocol.

## 8. Claim and lease protocol

### Claim

`claim_worker_task(worker_id, execution_class)` is a narrow `SECURITY DEFINER` operation callable only from the trusted broker.

It must atomically:

1. verify the worker is active and permitted for the requested closed execution class
2. select one eligible task using `FOR UPDATE SKIP LOCKED`
3. order deterministically by `priority DESC, available_at ASC, created_at ASC, id ASC`
4. reject tasks whose canonical `scan_jobs` row is terminal or cancellation-requested
5. enforce workspace and global concurrency policy
6. increment `attempt_count`
7. create an append-only attempt row
8. generate a high-entropy lease token, store only its digest, and return the plaintext token once
9. set the task to `leased`
10. set a 90-second lease expiry

Claim does not grant arbitrary scanner/network authority. It returns a server-generated immutable execution contract for that execution class.

### Heartbeat

The supervisor sends a heartbeat every 30 seconds.

A heartbeat succeeds only if:

- task ID, attempt ID, worker ID, and lease token all match
- the attempt is still active
- the task has not been terminalized
- the canonical job has not been terminalized
- the absolute task deadline has not passed

Each successful heartbeat may extend the lease to at most 90 seconds from the heartbeat, but never beyond `absolute_deadline_at`.

The heartbeat response includes `cancelRequested: boolean` derived from authoritative database state.

### Lease expiry

A lease that expires without a valid heartbeat is stale. The old worker loses commit authority immediately.

A recovery operation changes the attempt outcome to `lease_expired` and either:

- moves the task to `retry_wait` when attempts remain, or
- moves it to `dead_letter` and fails the canonical job with a bounded infrastructure failure code when the attempt limit is exhausted.

Default retry policy for 6A:

- maximum attempts: 3
- retry delays: 15 seconds after attempt 1, 60 seconds after attempt 2
- no fourth attempt

Provider failures cannot create unbounded retries.

## 9. Stale-worker and duplicate-delivery protection

All heartbeat and finalization calls require the exact current attempt identity and lease token.

The database stores a digest of the token and compares it inside the trusted RPC. An expired or superseded lease cannot be revived.

If an old worker finishes after another worker acquired the task, the old result is rejected. The newer lease wins even if the old computation started first.

Finalization is idempotent for the exact same attempt and terminal payload digest. Reusing an attempt identity with different terminal content fails closed.

External queue messages, if introduced later, are only wake-up hints. Duplicating or reordering them cannot change task ownership because PostgreSQL claim state is authoritative.

## 10. Cancellation semantics

The existing user-facing cancellation model remains authoritative: approved application logic sets `scan_jobs.cancel_requested_at`.

### Queued task

If cancellation is requested before claim, the worker task becomes `cancelled` and is never leased.

### Leased/running task

The next heartbeat returns `cancelRequested: true`. The supervisor must terminate the executor process/sandbox and call the cancellation finalizer.

The database must also allow a trusted recovery process to cancel a leased task after a short grace period if the worker disappears.

### Result race

A success/failure result may commit only if, in the same authoritative transaction:

- the lease is still current and unexpired
- cancellation has not won
- the canonical job is still in the expected mutable state
- the attempt has not already finalized

If cancellation is already recorded, success is rejected and the attempt/job are terminalized as cancelled according to the existing product semantics.

No worker may clear `cancel_requested_at`.

## 11. Resource-budget contract

6A introduces a pure provider-neutral `WorkerExecutionBudget` contract. Values are selected server-side from closed profiles, never submitted by the browser or repository.

The contract includes:

- `maxWallTimeMs`
- `maxCpuTimeMs`
- `maxMemoryBytes`
- `maxProcesses`
- `maxInputFiles`
- `maxInputBytes`
- `maxScratchBytes`
- `maxOutputBytes`

The worker supervisor must enforce hard outer limits even if the scanner has its own inner limits.

An executor result that exceeds output bounds is discarded and the attempt fails with a bounded code rather than persisting truncated/untrusted arbitrary data.

No 6A budget field authorizes network access.

## 12. Executor contract

The supervisor invokes an executor through a narrow interface conceptually equivalent to:

```text
execute({
  executionClass,
  immutableJobSnapshot,
  budget,
  inputDescriptor
}) -> bounded result envelope
```

The interface does not accept:

- shell command
- executable path from the caller
- image/container name from the caller
- arbitrary environment map
- arbitrary URL
- headers/body/cookies/credentials
- package-manager command/options
- network allowlist supplied by the job
- lifecycle target
- result/validation state chosen by the worker

Provider adapters translate the closed ScopeForge execution class into provider-specific sandbox settings. Provider-specific code stays below the worker-contract layer.

## 13. Network policy

Phase 6A distinguishes supervisor control traffic from executor target egress.

The worker supervisor may communicate only with required ScopeForge control endpoints and future private artifact storage.

The executor sandbox has zero outbound network authority in 6A. Network calls from repository-controlled code, scanner dependencies, package managers, cloud SDKs, metadata clients, DNS, HTTP, raw sockets, or subprocesses must fail.

This prevents cloud metadata theft, callback exfiltration, package-download execution, and SSRF from a hostile repository during the foundation slice.

Later network-enabled worker classes require a separate design and must reuse existing runtime-network target policy rather than inheriting a generic 6A escape hatch.

## 14. Result authority

In 6A, executor output is untrusted data.

The supervisor validates:

- schema version
- execution class
- job/attempt binding
- bounded text/counts/metrics
- no unexpected fields
- output byte limit

The worker cannot directly mutate `security_findings`, evidence, lifecycle state, runtime observations, or remediation state.

Later slices will add execution-class-specific trusted adapters that map bounded worker output into the existing atomic persistence RPCs or equivalent reviewed worker result transactions.

## 15. Auditing and observability

Security-relevant state changes append bounded events:

- `worker.task_queued`
- `worker.task_claimed`
- `worker.lease_expired`
- `worker.retry_scheduled`
- `worker.cancelled`
- `worker.failed`
- `worker.dead_lettered`
- `worker.succeeded`
- `worker.node_registered`
- `worker.node_disabled`

High-frequency heartbeat telemetry should not flood `audit_events`. Worker/node health belongs in bounded fleet state/metrics while security-significant lease transitions are audited.

No audit field may contain repository source, raw executor stdout/stderr, credentials, lease tokens, environment dumps, or unbounded exceptions.

## 16. Concurrency and backpressure

6A adds enforcement primitives but does not enable user-facing worker concurrency.

The current trial limit `concurrentScanJobsPerWorkspace: 0` remains unchanged.

Claim logic must support future server-defined limits for:

- global active leases
- active leases by execution class
- active leases per workspace
- queued tasks per workspace

When capacity is exhausted, tasks remain queued. The system does not start work and then attempt to account for capacity afterward.

Backpressure is therefore expressed by claim eligibility, not by spawning excess executors and killing them later.

## 17. Failure codes

Infrastructure failure codes are closed and bounded. Initial 6A examples:

- `WORKER_LEASE_EXPIRED`
- `WORKER_LOST`
- `WORKER_BUDGET_EXCEEDED`
- `WORKER_OUTPUT_INVALID`
- `WORKER_EXECUTION_FAILED`
- `WORKER_ATTEMPTS_EXHAUSTED`
- `WORKER_CANCELLED`
- `WORKER_CLASS_UNAVAILABLE`

Raw provider errors are logged privately with redaction where necessary, but do not become user-visible database fields.

## 18. Threat model

### Assets to protect

- Supabase service-role and other control-plane credentials
- worker credentials and lease tokens
- workspace/asset/job isolation
- hostile repository contents and future private artifacts
- canonical findings/evidence/history integrity
- runtime authorization snapshots
- worker fleet capacity and availability
- result provenance

### Threat actors

- malicious authenticated workspace user
- hostile repository author/content
- compromised executor process
- compromised or stale worker supervisor
- replaying network client with an old lease token
- duplicate/out-of-order queue delivery
- noisy tenant attempting resource exhaustion

### Threat: repository causes arbitrary host execution

Mitigations:

- fixed ScopeForge executor selected server-side
- no target lifecycle/package execution
- non-root sandbox
- no host/runtime sockets
- ephemeral filesystem
- process/CPU/memory/time bounds

### Threat: repository exfiltrates data or attacks network targets

Mitigations:

- executor has no egress in 6A
- no cloud metadata path
- no credentials in executor environment
- control-plane/broker credential exists only in supervisor

### Threat: cross-tenant task/result confusion

Mitigations:

- task foreign keys bind job/workspace/asset
- claim/finalization re-check canonical parent rows
- worker cannot submit workspace/asset authority independently
- result commit requires exact current attempt/lease

### Threat: stale worker commits after lease expiry

Mitigations:

- token hash plus exact attempt identity
- strict expiry
- expired/superseded lease cannot heartbeat or finalize
- result finalization is transactional

### Threat: cancellation loses to late success

Mitigations:

- canonical cancellation checked in finalization transaction
- cancelled tasks cannot be re-leased
- worker heartbeat communicates cancellation
- worker cannot clear cancellation

### Threat: queue poisoning or execution-configuration injection

Mitigations:

- worker task contains no arbitrary command, image, env, URL, package-manager, or network policy
- execution classes and budgets are closed server-side profiles
- external queue is never authoritative

### Threat: compromised worker gains database-wide authority

Mitigations:

- no service-role key in worker
- worker talks to narrow broker API
- independently revocable worker credential
- broker routes only fixed worker operations

### Threat: denial of service/fork bomb/output flood

Mitigations:

- claim-time concurrency limits
- hard executor resource ceilings
- bounded attempt count/backoff
- bounded result size
- dead-letter terminalization
- operational node disable/kill switch

### Threat: artifact tampering in later slices

6A requires the future input descriptor to carry content identity, byte length, and immutable artifact reference. 6B must verify content digest before mounting an artifact read-only. No unauthenticated mutable URL is acceptable as an input descriptor.

## 19. Database authority

Worker-control mutations use narrow `SECURITY DEFINER` functions with `search_path = ''`.

Browser roles receive no direct access to private worker tables and no EXECUTE privilege on worker mutation functions.

Only the trusted broker/service role may call the database worker functions in 6A.

Functions must independently validate state rather than trusting application checks.

Suggested function boundaries:

- `claim_worker_task`
- `heartbeat_worker_attempt`
- `finalize_worker_attempt_success`
- `finalize_worker_attempt_failure`
- `finalize_worker_attempt_cancelled`
- `recover_expired_worker_attempts`
- `register_worker_node`
- `disable_worker_node`

Final implementation may combine finalizers when doing so preserves a closed outcome enum and does not permit caller-selected product state.

## 20. Package/dependency boundaries

Recommended code boundaries:

- `packages/worker-contracts` - pure types/state validation; no database, framework, provider, filesystem, process, network, scanner, or UI dependencies
- `lib/worker-control` - trusted application orchestration and broker contracts
- `packages/worker-supervisor` - provider-neutral supervisor logic; control channel, heartbeat, cancellation, resource/result accounting
- `packages/worker-executor-*` - later provider adapters implementing the sandbox contract

Architecture tests must prove:

- browser/components cannot import worker supervisor/provider modules
- worker contracts cannot import Supabase/Next.js/providers/scanners/network
- executor provider code cannot import application service-role helpers
- worker supervisor cannot import generic runtime target networking in 6A
- no `child_process`/shell execution outside explicitly reviewed provider/executor adapters
- no provider adapter accepts caller-selected command/image/env/network configuration
- Phase 5C import modules remain unable to acquire worker execution authority

## 21. Tests required before implementation can be accepted

Because GitHub Actions is currently unavailable, these tests must still be written and run through available local/direct verification paths where possible. They remain permanent repository tests for when CI quota returns.

### Database/state-machine tests

- two workers racing to claim one task -> exactly one lease
- duplicate claim wake-up -> no duplicate active lease
- stale lease token heartbeat/finalize -> rejected
- expired lease recovery -> retry with incremented attempt
- max-attempt exhaustion -> dead-letter/failed once
- deterministic retry backoff
- cancellation before claim -> never leased
- cancellation during lease -> late success rejected
- heartbeat after cancellation -> returns cancellation and cannot extend indefinitely
- finalization idempotency for identical terminal payload
- conflicting terminal replay -> rejected
- workspace/global capacity enforced before claim
- worker-disabled state prevents claim/heartbeat extension

### Isolation contract tests

- executor receives no broker/service-role credential
- executor environment excludes arbitrary caller env
- no caller-selected command/image
- network capability absent from 6A execution profile
- output and resource metrics are bounded
- repository data cannot enter audit/failure fields

### Architecture tests

- forbidden dependency directions listed above
- direct browser mutation of worker state absent
- worker DB RPC grants are broker/service-role only
- empty pinned search paths

### Recovery simulations

- worker dies before first heartbeat
- worker dies after producing output but before finalization
- broker retries finalization
- database connection drops during heartbeat
- cancellation and lease expiry occur concurrently
- recovery runner executes twice concurrently

## 22. Migration/deployment strategy

6A schema changes are additive and should be deployable before application code.

Recommended order:

1. private worker tables and constraints
2. indexes and immutable/guard triggers
3. service-role-only worker RPCs
4. application types/contracts
5. broker/supervisor code
6. shadow-mode worker registration/claim tests only
7. Supabase security and performance advisor reconciliation

No existing passive/active production job is moved to the worker path in 6A. Rollback of application code therefore cannot strand currently supported scans on the new worker subsystem.

## 23. Explicit non-goals

Phase 6A does not implement:

- GitHub repository cloning/fetching
- user repository upload UX
- package installation
- package lifecycle execution
- build/test execution of target projects
- generalized shell access
- arbitrary container images
- arbitrary environment variables
- outbound scanner networking
- new active HTTP validators
- authenticated target testing
- crawling/fuzzing/exploit probes
- direct worker writes to findings/evidence/lifecycle tables
- public worker APIs
- changing the current trial concurrent-scan limit from zero

## 24. Success criteria

Phase 6A is complete only when:

1. task claim ownership is atomic and deterministic under concurrency
2. stale/expired workers cannot commit results
3. cancellation reliably wins over late worker completion
4. retries are bounded and dead-letter behavior is deterministic
5. workers do not possess database-wide credentials
6. executor sandboxes have no target egress or control-plane secrets
7. caller-controlled execution configuration is structurally impossible
8. workspace/global capacity is enforced at claim time
9. resource limits exist as a provider-neutral server-defined contract
10. audit/fleet state contains no repository/source/secret dumps
11. the worker subsystem can be introduced without changing existing Phase 4/5 execution behavior
12. architecture and database authority tests make these properties executable

## 25. Decision summary

Phase 6A will use PostgreSQL as the authoritative worker queue/lease state and keep `scan_jobs` as the canonical product job lifecycle. Workers are unprivileged relative to the database, communicate through a narrow broker, and execute hostile inputs only in zero-egress bounded sandboxes. External managed queues and specific container providers remain replaceable delivery/execution adapters, not security authorities.

This gives ScopeForge a durable isolation foundation without prematurely granting hosted repository acquisition or generalized network execution.