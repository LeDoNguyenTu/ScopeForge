# Phase 6A Durable Worker Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a durable, provider-neutral worker queue/lease/cancellation foundation that cannot widen ScopeForge execution or network authority and does not enable any existing product scan job on workers yet.

**Architecture:** PostgreSQL remains authoritative for worker task eligibility, lease ownership, cancellation, retry, and terminalization while `scan_jobs` remains the canonical product job lifecycle. Workers authenticate to a narrow broker, never receive Supabase `service_role`, and operate against closed execution classes and server-defined budgets; Phase 6A provides the executor contract and shadow-mode foundation probe only, with no repository acquisition or target-network egress.

**Tech Stack:** TypeScript, Next.js App Router, Supabase/PostgreSQL, Vitest, Node.js 22+, existing ScopeForge audit/database patterns.

**Spec:** `docs/superpowers/specs/2026-08-26-phase-6a-worker-foundation-design.md`

## Global Constraints

- Do not trigger or rerun GitHub Actions while the monthly allowance is exhausted; implementation commits use `[skip ci]`.
- Keep `TRIAL_LIMITS.concurrentScanJobsPerWorkspace` equal to `0` in Phase 6A.
- No existing `passive_runtime`, `active_validation`, or `phase3_import` product job is routed through workers in Phase 6A.
- Workers never receive Supabase `service_role` or other control-plane credentials.
- Browser/authenticated roles receive no direct worker-table access and no worker mutation RPC execution.
- Worker RPCs are narrow `SECURITY DEFINER` functions with `search_path = ''`, revoked from `PUBLIC`, `anon`, and `authenticated`, granted only to `service_role`.
- `scan_jobs` remains the only product-visible lifecycle; private worker task state is scheduling state only.
- Phase 6A execution classes and budgets are closed server-defined values; callers cannot choose commands, images, environment maps, URLs, headers, bodies, package-manager options, network policy, validation state, or lifecycle targets.
- Executor target/network egress is absent in Phase 6A. The worker supervisor control channel is separate from executor capabilities.
- External queues may be added later only as wake-up hints; PostgreSQL lease state remains authoritative.

---

### Task 1: Pure worker contracts and closed execution profiles

**Files:**
- Create: `packages/worker-contracts/types.ts`
- Create: `packages/worker-contracts/profiles.ts`
- Create: `packages/worker-contracts/validation.ts`
- Create: `packages/worker-contracts/index.ts`
- Test: `tests/workers/contracts.test.ts`
- Test: `tests/architecture/worker-contracts-dependencies.test.ts`

**Interfaces:**
- Produces `WorkerExecutionClass = "foundation_no_egress_v1"`.
- Produces `WorkerExecutionBudget`, `WorkerTaskContract`, `WorkerAttemptMetrics`, `WorkerTerminalEnvelope`.
- Produces `workerExecutionProfile(executionClass)` and `validateWorkerTerminalEnvelope(value, expected)`.
- Later tasks consume these types; this package imports no database, framework, scanner, filesystem, process, network, provider, UI, or model modules.

- [ ] **Step 1: Write failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
  workerExecutionProfile,
  validateWorkerTerminalEnvelope,
} from "@/packages/worker-contracts";

describe("worker contracts", () => {
  it("keeps the Phase 6A execution class closed and zero-egress", () => {
    expect(workerExecutionProfile("foundation_no_egress_v1")).toEqual({
      executionClass: "foundation_no_egress_v1",
      networkPolicy: "none",
      budget: {
        maxWallTimeMs: 30_000,
        maxCpuTimeMs: 20_000,
        maxMemoryBytes: 268_435_456,
        maxProcesses: 4,
        maxInputFiles: 100,
        maxInputBytes: 10_485_760,
        maxScratchBytes: 33_554_432,
        maxOutputBytes: 1_048_576,
      },
    });
  });

  it("rejects terminal envelopes with unexpected authority fields", () => {
    expect(() => validateWorkerTerminalEnvelope({
      schemaVersion: 1,
      taskId: "task-1",
      attemptId: "attempt-1",
      executionClass: "foundation_no_egress_v1",
      outcome: "succeeded",
      metrics: {
        wallTimeMs: 1,
        cpuTimeMs: 1,
        peakMemoryBytes: 1,
        inputBytes: 0,
        outputBytes: 0,
      },
      command: "curl https://example.com",
    }, {
      taskId: "task-1",
      attemptId: "attempt-1",
      executionClass: "foundation_no_egress_v1",
    })).toThrow(/unexpected/i);
  });
});
```

- [ ] **Step 2: Run focused RED tests**

Run locally when the repository is materialized:

```bash
npx vitest run tests/workers/contracts.test.ts tests/architecture/worker-contracts-dependencies.test.ts
```

Expected: FAIL because `packages/worker-contracts` does not exist.

- [ ] **Step 3: Implement minimal pure contracts**

```ts
export type WorkerExecutionClass = "foundation_no_egress_v1";
export type WorkerNetworkPolicy = "none";

export interface WorkerExecutionBudget {
  maxWallTimeMs: number;
  maxCpuTimeMs: number;
  maxMemoryBytes: number;
  maxProcesses: number;
  maxInputFiles: number;
  maxInputBytes: number;
  maxScratchBytes: number;
  maxOutputBytes: number;
}

export interface WorkerTaskContract {
  taskId: string;
  attemptId: string;
  executionClass: WorkerExecutionClass;
  leaseToken: string;
  absoluteDeadlineAt: string;
  budget: WorkerExecutionBudget;
  input: { kind: "foundation_probe"; nonce: string };
}
```

`profiles.ts` returns the exact immutable profile asserted above. `validation.ts` performs strict own-key validation, closed outcome validation (`succeeded | failed | cancelled`), exact task/attempt/class binding, non-negative integer metrics, bounded failure codes, and serialized output-size enforcement.

- [ ] **Step 4: Make dependency guard executable**

The architecture test reads files under `packages/worker-contracts` and rejects imports matching:

```ts
const forbidden = [
  "next/", "@supabase/", "node:fs", "node:child_process", "node:http",
  "node:https", "node:net", "node:dns", "node:tls", "node:worker_threads",
  "runtime-network", "runtime-observer", "runtime-validator", "scanner-",
  "openai", "anthropic", "@google/generative-ai",
];
```

- [ ] **Step 5: Commit**

```bash
git add packages/worker-contracts tests/workers/contracts.test.ts tests/architecture/worker-contracts-dependencies.test.ts
git commit -m "feat: add pure worker execution contracts [skip ci]"
```

---

### Task 2: Private worker schema and immutable scheduling model

**Files:**
- Create: `supabase/migrations/20260826110000_phase_6a_worker_foundation.sql`
- Test: `tests/workers/migration.test.ts`

**Interfaces:**
- Produces private tables `worker_nodes`, `worker_tasks`, `worker_attempts`.
- Produces closed database state values matching the approved spec.
- Does not yet expose claim/heartbeat/finalization RPCs; Task 3 adds those transactions.

- [ ] **Step 1: Write RED migration assertions**

The test reads the SQL file and asserts:

```ts
expect(sql).toContain("create table private.worker_nodes");
expect(sql).toContain("create table private.worker_tasks");
expect(sql).toContain("create table private.worker_attempts");
expect(sql).toContain("foundation_no_egress_v1");
expect(sql).not.toMatch(/command\s+text/i);
expect(sql).not.toMatch(/image\s+text/i);
expect(sql).not.toMatch(/environment\s+jsonb/i);
expect(sql).not.toMatch(/headers\s+jsonb/i);
expect(sql).not.toMatch(/network.*jsonb/i);
```

Also assert exact FK binding from task to `(scan_job_id, workspace_id, asset_id)` and no grants to browser roles.

- [ ] **Step 2: Run RED test**

```bash
npx vitest run tests/workers/migration.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Add worker tables and constraints**

Key schema:

```sql
create table private.worker_nodes (
  id uuid primary key default gen_random_uuid(),
  credential_hash text not null unique,
  execution_class text not null check (execution_class = 'foundation_no_egress_v1'),
  software_version text not null check (char_length(software_version) between 1 and 64),
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz,
  disabled_at timestamptz
);

create table private.worker_tasks (
  id uuid primary key default gen_random_uuid(),
  scan_job_id uuid not null unique,
  workspace_id uuid not null,
  asset_id uuid not null,
  execution_class text not null check (execution_class = 'foundation_no_egress_v1'),
  state text not null check (state in ('queued','leased','retry_wait','completed','dead_letter','cancelled')),
  priority smallint not null default 0,
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  max_attempts integer not null default 3 check (max_attempts between 1 and 3),
  absolute_deadline_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (scan_job_id, workspace_id, asset_id)
    references public.scan_jobs(id, workspace_id, asset_id) on delete cascade
);
```

`worker_attempts` binds `(task_id, worker_id)`, has unique `(task_id, attempt_number)`, stores only a SHA-256 lease token digest, bounded resource metrics, optional terminal payload digest, and closed attempt outcomes.

- [ ] **Step 4: Add guard triggers and indexes**

Guard immutable identity fields, prevent terminal task resurrection, prevent attempt identity/lease ownership mutation, and index claim/recovery paths:

```sql
create index worker_tasks_claim_idx
  on private.worker_tasks(execution_class, state, priority desc, available_at, created_at, id);
create index worker_attempts_active_lease_idx
  on private.worker_attempts(lease_expires_at)
  where finished_at is null;
```

- [ ] **Step 5: Run focused migration test and commit**

```bash
npx vitest run tests/workers/migration.test.ts
git add supabase/migrations/20260826110000_phase_6a_worker_foundation.sql tests/workers/migration.test.ts
git commit -m "feat: add private worker scheduling schema [skip ci]"
```

---

### Task 3: Atomic worker RPC state machine

**Files:**
- Modify: `supabase/migrations/20260826110000_phase_6a_worker_foundation.sql`
- Test: `tests/workers/migration.test.ts`
- Test: `tests/workers/state-machine-contract.test.ts`

**Interfaces:**
- Produces service-role-only RPCs: `register_worker_node`, `disable_worker_node`, `enqueue_foundation_worker_task`, `claim_worker_task`, `heartbeat_worker_attempt`, `finalize_worker_attempt`, `recover_expired_worker_attempts`.
- `finalize_worker_attempt` consumes a closed `terminal_outcome` of `succeeded | failed | cancelled`, never a caller-selected `scan_jobs.status`.

- [ ] **Step 1: Extend migration tests for RPC authority**

```ts
for (const fn of [
  "register_worker_node",
  "disable_worker_node",
  "enqueue_foundation_worker_task",
  "claim_worker_task",
  "heartbeat_worker_attempt",
  "finalize_worker_attempt",
  "recover_expired_worker_attempts",
]) {
  expect(sql).toContain(`function public.${fn}`);
}
expect(sql).toMatch(/security definer/gi);
expect(sql).toMatch(/set search_path = ''/g);
expect(sql).toMatch(/revoke execute on function[\s\S]*from public, anon, authenticated/gi);
expect(sql).toMatch(/grant execute on function[\s\S]*to service_role/gi);
```

- [ ] **Step 2: Specify claim/lease race behavior**

The SQL contract must contain `FOR UPDATE SKIP LOCKED`, deterministic ordering, active-worker verification, task/job cancellation checks, capacity checks, attempt increment, 32-byte random lease token generation, SHA-256 digest storage, and a 90-second lease.

- [ ] **Step 3: Implement exact retry and recovery policy**

```sql
case current_attempt
  when 1 then interval '15 seconds'
  when 2 then interval '60 seconds'
  else null
end
```

After attempt 3, recovery moves task to `dead_letter` and canonical job to `failed` with `WORKER_ATTEMPTS_EXHAUSTED`. No fourth attempt exists.

- [ ] **Step 4: Implement cancellation-wins finalization**

Inside the finalization transaction, lock task, attempt, and canonical scan job. Validate exact worker + lease digest + unexpired lease. If `cancel_requested_at is not null`, reject success/failure and terminalize the worker task/attempt as cancelled. Identical finalization replay with the same payload digest returns the previous terminal result; a different digest raises `WORKER_TERMINAL_CONFLICT`.

- [ ] **Step 5: Add shadow enqueue restriction**

`enqueue_foundation_worker_task` must reject any scan job except a service-created internal foundation probe record. It must not accept a product job kind from the caller. Use an internal marker in the task transaction rather than changing existing user-facing job creation flows.

- [ ] **Step 6: Run focused tests and commit**

```bash
npx vitest run tests/workers/migration.test.ts tests/workers/state-machine-contract.test.ts
git add supabase/migrations/20260826110000_phase_6a_worker_foundation.sql tests/workers
git commit -m "feat: add atomic worker lease state machine [skip ci]"
```

---

### Task 4: Database types and trusted worker-control repository

**Files:**
- Modify: `lib/database.types.ts`
- Create: `lib/worker-control/types.ts`
- Create: `lib/worker-control/repository.ts`
- Create: `lib/worker-control/service.ts`
- Create: `lib/worker-control/server-dependencies.ts`
- Test: `tests/workers/repository.test.ts`
- Test: `tests/workers/service.test.ts`

**Interfaces:**
- Repository wraps only the Phase 6A RPCs; it does not expose arbitrary SQL/table mutation.
- Service produces `registerWorker`, `disableWorker`, `claimTask`, `heartbeatAttempt`, `finalizeAttempt`, `recoverExpiredAttempts`.
- Service accepts trusted worker identity and validated contract data, never browser workspace/asset authority.

- [ ] **Step 1: Write RED service tests**

```ts
it("never accepts service-role or arbitrary execution configuration in worker input", async () => {
  const input = {
    workerId: "worker-1",
    executionClass: "foundation_no_egress_v1" as const,
  };
  await claimTask(input, deps);
  expect(deps.repository.claim).toHaveBeenCalledWith(input);
});
```

Use TypeScript compile-time fixtures plus runtime own-key checks to prove there is no `command`, `image`, `env`, `url`, `headers`, `body`, or `networkPolicy` caller field.

- [ ] **Step 2: Update central database contract**

Add the new RPC signatures and private-worker return DTO aliases needed by trusted server code. Do not grant browser query types for private tables as product read models.

- [ ] **Step 3: Implement narrow repository**

```ts
export interface WorkerControlRepository {
  claim(input: { workerId: string; executionClass: WorkerExecutionClass }): Promise<WorkerTaskContract | null>;
  heartbeat(input: WorkerLeaseIdentity): Promise<{ cancelRequested: boolean; leaseExpiresAt: string }>;
  finalize(input: WorkerFinalizationInput): Promise<WorkerFinalizationResult>;
  recover(nowIso: string): Promise<number>;
}
```

Map raw database failures into closed codes such as `WORKER_LEASE_INVALID`, `WORKER_TERMINAL_CONFLICT`, `WORKER_DISABLED`, `WORKER_CAPACITY_UNAVAILABLE`.

- [ ] **Step 4: Build server dependencies from `createAdminClient()` only inside server code**

No client component or worker-facing payload receives the admin client or service key.

- [ ] **Step 5: Run focused tests and commit**

```bash
npx vitest run tests/workers/repository.test.ts tests/workers/service.test.ts
git add lib/database.types.ts lib/worker-control tests/workers
git commit -m "feat: add trusted worker control service [skip ci]"
```

---

### Task 5: Scoped worker credential authentication and broker routes

**Files:**
- Create: `lib/worker-control/auth.ts`
- Create: `app/api/internal/workers/claim/route.ts`
- Create: `app/api/internal/workers/heartbeat/route.ts`
- Create: `app/api/internal/workers/finalize/route.ts`
- Test: `tests/workers/broker-auth.test.ts`
- Test: `tests/workers/broker-routes.test.ts`

**Interfaces:**
- Worker sends `Authorization: Bearer <worker-secret>` plus `X-ScopeForge-Worker-Id`.
- Broker hashes the secret with SHA-256 and resolves exactly one active worker node through trusted server dependencies.
- Routes expose only claim, heartbeat, and finalization operations.

- [ ] **Step 1: Write RED authentication tests**

Cover missing/malformed bearer, wrong worker ID, wrong digest, disabled node, oversized headers, and successful constant-time digest comparison.

- [ ] **Step 2: Implement authentication without database-wide credential disclosure**

```ts
export function workerCredentialDigest(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}
```

Use `timingSafeEqual` for equal-length digest comparison. Never log bearer values or lease tokens.

- [ ] **Step 3: Implement strict JSON route schemas**

Claim body may contain only `executionClass`. Heartbeat body may contain only `taskId`, `attemptId`, `leaseToken`. Finalize body may contain only lease identity plus a validated `WorkerTerminalEnvelope`.

Reject unexpected keys, wrong content type, and bodies above 64 KiB.

- [ ] **Step 4: Add same-origin/user-session non-requirement explicitly**

These are worker-authenticated server-to-server routes, not browser actions. Ensure normal authenticated user cookies do not satisfy worker authentication.

- [ ] **Step 5: Commit**

```bash
git add lib/worker-control/auth.ts app/api/internal/workers tests/workers
git commit -m "feat: add scoped worker broker API [skip ci]"
```

---

### Task 6: Provider-neutral supervisor and cancellation loop

**Files:**
- Create: `packages/worker-supervisor/control-client.ts`
- Create: `packages/worker-supervisor/executor.ts`
- Create: `packages/worker-supervisor/supervisor.ts`
- Create: `packages/worker-supervisor/index.ts`
- Test: `tests/workers/supervisor.test.ts`

**Interfaces:**
- `WorkerControlClient`: `claim`, `heartbeat`, `finalize`.
- `WorkerExecutor`: `execute(contract, signal) -> WorkerTerminalEnvelope`.
- `runWorkerOnce(deps)` claims at most one task, runs exactly one closed execution contract, heartbeats every 30 seconds, aborts executor on cancellation, and finalizes once.

- [ ] **Step 1: Write failure/recovery simulations first**

Tests cover:

```ts
it("aborts execution when heartbeat reports cancellation", async () => { /* ... */ });
it("does not retry finalization with changed terminal content", async () => { /* ... */ });
it("treats lost control channel as executor abort rather than continuing indefinitely", async () => { /* ... */ });
it("never passes worker credential into the executor contract", async () => { /* ... */ });
```

- [ ] **Step 2: Implement executor interface with no network capability parameter**

```ts
export interface WorkerExecutor {
  execute(
    contract: Omit<WorkerTaskContract, "leaseToken">,
    signal: AbortSignal,
  ): Promise<WorkerTerminalEnvelope>;
}
```

The supervisor retains the lease token; executor never sees it.

- [ ] **Step 3: Implement bounded heartbeat loop**

Start execution and a 30-second heartbeat timer. Any cancellation response aborts the executor. Two consecutive control-channel failures abort the executor and return a local `WORKER_LOST` result; the database lease then expires/recovery owns retry.

- [ ] **Step 4: Validate output before finalization**

Call `validateWorkerTerminalEnvelope` and replace invalid/oversized output with a bounded `failed / WORKER_OUTPUT_INVALID` terminal envelope.

- [ ] **Step 5: Commit**

```bash
git add packages/worker-supervisor tests/workers/supervisor.test.ts
git commit -m "feat: add provider neutral worker supervisor [skip ci]"
```

---

### Task 7: Shadow foundation probe and fleet/recovery operations

**Files:**
- Create: `packages/worker-supervisor/foundation-probe.ts`
- Create: `lib/worker-control/fleet.ts`
- Create: `lib/worker-control/recovery.ts`
- Test: `tests/workers/foundation-probe.test.ts`
- Test: `tests/workers/recovery.test.ts`

**Interfaces:**
- Foundation probe is deterministic and does not read repository content, spawn a shell, access network, or mutate findings.
- Recovery calls only `recoverExpiredAttempts` and is safe when invoked concurrently.

- [ ] **Step 1: Add deterministic shadow executor test**

```ts
expect(await executeFoundationProbe({ kind: "foundation_probe", nonce: "abc" }, signal)).toEqual({
  schemaVersion: 1,
  outcome: "succeeded",
  result: { nonceDigest: expect.stringMatching(/^[a-f0-9]{64}$/) },
  // bounded metrics populated by supervisor wrapper
});
```

- [ ] **Step 2: Implement probe with pure hashing only**

Use `node:crypto` only. No filesystem, child process, worker thread, DNS, HTTP, socket, scanner, or provider imports.

- [ ] **Step 3: Implement bounded fleet read model for trusted operations**

Expose counts/health only: worker ID, execution class, software version, registered/last-seen/disabled timestamps, active lease count, queued/retry/dead-letter counts. No credentials, lease digests/tokens, raw outputs, source, repository contents, or environment data.

- [ ] **Step 4: Implement recovery entry point**

`recoverExpiredWorkerAttempts(now = new Date())` invokes the single database recovery RPC. Concurrent invocations are safe because the RPC owns row locks and terminal checks.

- [ ] **Step 5: Commit**

```bash
git add packages/worker-supervisor/foundation-probe.ts lib/worker-control/fleet.ts lib/worker-control/recovery.ts tests/workers
git commit -m "feat: add worker shadow probe and recovery operations [skip ci]"
```

---

### Task 8: Architecture and authority guards

**Files:**
- Create: `tests/architecture/worker-authority-boundaries.test.ts`
- Modify: `tests/architecture/phase3-import-dependencies.test.ts`
- Test: `tests/workers/migration.test.ts`

**Interfaces:**
- Produces permanent executable guards for the approved Phase 6A trust zones.

- [ ] **Step 1: Guard browser/control-plane dependency direction**

Reject imports of `packages/worker-supervisor` from `app/**` except `app/api/internal/workers/**`, and reject all supervisor imports from `components/**`.

- [ ] **Step 2: Guard supervisor target-network authority**

Reject `runtime-network`, `runtime-observer`, `runtime-validator`, `node:http`, `node:https`, `node:net`, `node:dns`, `node:tls`, and global `fetch(` inside `packages/worker-supervisor` during 6A.

- [ ] **Step 3: Guard execution configuration injection**

Scan worker DTOs, route schemas, migration columns, and RPC argument names for forbidden authority concepts:

```ts
const forbiddenAuthority = [
  "command", "shell", "image", "containerName", "environment", "env",
  "url", "headers", "body", "cookies", "credentials", "packageManager",
  "networkAllowlist", "networkPolicy", "lifecycleState", "validationState",
];
```

Allow the literal server-owned `networkPolicy: "none"` only inside the pure profile definition, never in caller DTOs.

- [ ] **Step 4: Preserve Phase 5C isolation**

Extend the existing Phase 5C architecture guard so `lib/phase3-import` cannot import worker-control/supervisor modules.

- [ ] **Step 5: Commit**

```bash
git add tests/architecture tests/workers/migration.test.ts
git commit -m "test: lock Phase 6A worker authority boundaries [skip ci]"
```

---

### Task 9: Direct verification, Supabase reconciliation, PR review, and merge

**Files:**
- Modify after verification: `docs/ARCHITECTURE.md`
- Modify after verification: `docs/PHASES.md`
- Modify after verification: `docs/development/CURRENT_STATE.md`
- Modify after verification: `docs/development/TEST_STATUS.md`
- Modify after verification: `docs/development/NEXT_STEPS.md`
- Modify after verification: `docs/development/SESSION_HANDOFF.md`

**Interfaces:**
- No GitHub Actions usage.
- Production schema may be deployed additively because no existing product job moves to the worker path.

- [ ] **Step 1: Run every locally available repository gate without Actions**

When a materialized repository is available:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

If the environment cannot run a command, record that limitation rather than claiming success.

- [ ] **Step 2: Run targeted worker tests separately**

```bash
npx vitest run tests/workers tests/architecture/worker-contracts-dependencies.test.ts tests/architecture/worker-authority-boundaries.test.ts tests/architecture/phase3-import-dependencies.test.ts
```

- [ ] **Step 3: Perform targeted security diff review**

Review for service-role leakage, worker credential leakage, stale lease/result races, cancellation ordering, cross-workspace binding, retry exhaustion, capacity bypass, audit leakage, execution config injection, and accidental target-network imports.

- [ ] **Step 4: Deploy the additive Phase 6A migration to ScopeForge Supabase**

Apply only the exact reviewed migration content. Verify tables/functions/constraints/indexes and generated TypeScript types.

- [ ] **Step 5: Verify production authority directly**

Require:

- worker tables are in `private` schema and inaccessible to `anon`/`authenticated`
- every worker mutation RPC is `SECURITY DEFINER`
- every worker RPC has `search_path = ''`
- `PUBLIC`, `anon`, and `authenticated` cannot execute worker mutation RPCs
- `service_role` can execute them
- lease/attempt/task guards and indexes exist
- Supabase security advisor is clean
- Phase 6A missing-FK-index notices are zero after any required reviewed index hardening migration

- [ ] **Step 6: Shadow smoke only**

Register one test worker node, create one internal foundation probe task, claim it, heartbeat it, finalize the deterministic probe, then confirm no `security_findings`, runtime observations, asset verification, or user-visible scan execution authority changed. Remove/revoke the test worker afterward.

- [ ] **Step 7: Update permanent docs truthfully**

Record that Phase 6A does not move production scanners to workers and that final verification did not use GitHub Actions. Include exact PR head, merge SHA, production migration versions, advisor results, and any local/direct verification limitations.

- [ ] **Step 8: Merge exact reviewed head only**

Require zero blocking review threads and use `expected_head_sha`. Do not enable or run GitHub Actions as part of the merge gate.

- [ ] **Step 9: Commit final reconciliation with `[skip ci]`**

```bash
git add docs
git commit -m "docs: reconcile Phase 6A worker foundation [skip ci]"
```
