# Phase 5B Remediation, Retest, and Security Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add remediation ownership, deterministic retesting, verified-fix semantics, and a read-only Security Story v1 on top of the Phase 5A canonical hosted finding ledger.

**Architecture:** Phase 5B adds two workspace-scoped workflow tables and narrow service-role-only PostgreSQL RPCs. Retests orchestrate the existing passive-runtime or active-CORS services through a closed source registry; no new network authority is created. Security Story v1 is a pure bounded read model over canonical finding/evidence/work/retest state.

**Tech Stack:** Next.js 15, React 19, TypeScript strict mode, Supabase/PostgreSQL/RLS, Vitest, existing ScopeForge runtime services and security-domain contracts.

**Spec:** `docs/superpowers/specs/2026-08-25-phase-5b-remediation-retest-security-story-design.md`

## Global Constraints

- `security_findings` remains the only canonical finding state.
- No browser mutation access to workflow tables or mutation RPCs.
- No new HTTP/network/scanner authority and no direct `runtime-network` import from remediation code.
- Active retest remains exactly `cors-origin-policy@1` and requires owner/admin plus explicit consent.
- Passive retest uses the existing passive-runtime service and fixed `RUNTIME_OBSERVATION_MAX_BUDGET`.
- Active retest uses the existing active-validation service and fixed `ACTIVE_VALIDATION_MAX_BUDGET`.
- `verified_fixed` requires a fresh successful exact-source/profile retest with no target occurrence for that exact job.
- Failed, blocked, cancelled, unsupported, or drifted retests cannot verify a fix.
- Remediation note maximum is 2000 characters; retest history read maximum is 50 rows.
- Risk acceptance, false-positive actions, hosted Phase 3 import, model execution, generalized DAST, and Phase 6 worker infrastructure remain out of scope.
- Every task follows RED -> GREEN TDD and ends at a reviewable checkpoint.

---

### Task 1: Phase 5B workflow schema and generated-equivalent database types

**Files:**
- Create: `supabase/migrations/20260825090000_phase_5b_remediation_retest_security_story.sql`
- Modify: `lib/database.types.ts`
- Create: `tests/security-remediation/migration.test.ts`

**Interfaces:**
- Produces tables `security_finding_work`, `security_finding_retests`.
- Produces RPC type signatures for `change_security_finding_work`, `request_security_finding_retest`, `mark_security_finding_retest_running`, `finalize_security_finding_retest`.

- [ ] **Step 1: Write migration contract tests first**

Require:

```ts
expect(sql).toContain("create table public.security_finding_work");
expect(sql).toContain("create table public.security_finding_retests");
expect(sql).toContain("security_finding_retests_one_active_per_finding");
expect(sql).toContain("grant select on table public.security_finding_work to authenticated");
expect(sql).toContain("grant select on table public.security_finding_retests to authenticated");
expect(sql).not.toMatch(/grant\s+(?:insert|update|delete).*security_finding_(?:work|retests).*authenticated/is);
expect(sql).toContain("set search_path = ''");
```

Also assert retest snapshot immutability, active/passive snapshot checks, 2000-character note bound, 50-row read indexes, and the five new append-only event types.

- [ ] **Step 2: Run RED**

Run `npm test -- tests/security-remediation/migration.test.ts`.

Expected: migration file missing.

- [ ] **Step 3: Implement schema**

Create the two tables, RLS SELECT policies, SELECT-only browser grants, partial unique active-retest index, immutable retest snapshot trigger, event-type constraint extension, and narrow service-role-only function declarations required by later tasks. RPC bodies may initially raise a stable `NOT_IMPLEMENTED` exception only if the migration test does not treat them as functional yet; functional behavior is implemented test-first in Tasks 3-5 before merge.

- [ ] **Step 4: Add database types**

Add exact row/insert/update types and RPC argument/return types to `lib/database.types.ts`.

- [ ] **Step 5: Run GREEN**

Run migration tests, `npm run typecheck`, then the full repository gate.

- [ ] **Step 6: Commit**

Commit message: `feat: add Phase 5B workflow schema`.

---

### Task 2: Closed retest source registry and application contracts

**Files:**
- Create: `lib/security-remediation/types.ts`
- Create: `lib/security-remediation/source-registry.ts`
- Create: `tests/security-remediation/source-registry.test.ts`

**Interfaces:**

```ts
export type RetestExecutionKind = "passive_runtime" | "active_validation";

export interface RetestSourceDescriptor {
  executionKind: RetestExecutionKind;
  sourceId: string;
  sourceVersion: string | null;
  validationProfileId: "cors-origin-policy" | null;
  validationProfileVersion: 1 | null;
}

export function resolveRetestSource(
  finding: SecurityFindingRow,
): RetestSourceDescriptor | null;
```

Only these mappings exist:

```text
scopeforge:runtime-observer -> passive_runtime
scopeforge:runtime-validator + cors-origin-policy@1 -> active_validation
```

- [ ] Write tests proving known sources resolve, unknown/external/advisory/user-confirmed sources do not, and no target URL/method/header/body/budget exists in the descriptor.
- [ ] Run RED.
- [ ] Implement the minimal closed registry.
- [ ] Run GREEN and typecheck.
- [ ] Commit `feat: add closed retest source registry`.

---

### Task 3: Remediation assignment and note transaction

**Files:**
- Modify: Phase 5B migration
- Create: `lib/security-remediation/repository.ts`
- Create: `lib/security-remediation/service.ts`
- Create: `tests/security-remediation/workflow.test.ts`
- Create: `tests/security-remediation/repository.test.ts`

**Interfaces:**

```ts
export interface UpdateFindingWorkInput {
  actorId: string;
  workspaceId: string;
  role: WorkspaceRole;
  findingId: string;
  assigneeUserId: string | null;
  remediationNote: string | null;
}

export async function updateFindingWork(
  input: UpdateFindingWorkInput,
  dependencies: SecurityRemediationServiceDependencies,
): Promise<SecurityFindingWorkRow>;
```

Repository RPC:

```ts
changeFindingWork(input: {
  workspaceId: string;
  findingId: string;
  actorId: string;
  assigneeUserId: string | null;
  remediationNote: string | null;
}): Promise<SecurityFindingWorkRow>;
```

- [ ] Write RED tests for viewer rejection, member self-assignment only, owner/admin assignment to current workspace members, invalid assignee rejection, 2001-character note rejection, and append-only assignment/note events.
- [ ] Implement `change_security_finding_work` with independent DB membership/role checks and row locking.
- [ ] Implement repository and safe service errors; never return raw SQL text.
- [ ] Run GREEN/full gate.
- [ ] Commit `feat: add trusted remediation work tracking`.

---

### Task 4: Atomic retest request and lifecycle transition

**Files:**
- Modify: Phase 5B migration
- Modify: `lib/security-remediation/repository.ts`
- Modify: `lib/security-remediation/service.ts`
- Create: `tests/security-remediation/retest-request.test.ts`

**Interfaces:**

```ts
export interface RequestFindingRetestInput {
  actorId: string;
  workspaceId: string;
  role: WorkspaceRole;
  findingId: string;
  explicitConsent: boolean;
}

export async function requestFindingRetest(
  input: RequestFindingRetestInput,
  dependencies: SecurityRemediationServiceDependencies,
): Promise<SecurityFindingRetestRow>;
```

Database request RPC atomically:

1. locks canonical finding;
2. requires `resolved`;
3. prevents a second active retest;
4. inserts immutable source/profile snapshot;
5. transitions `resolved -> retest_pending`;
6. appends `finding.retest_requested`.

- [ ] Write RED tests for non-resolved rejection, unsupported source, active consent missing, active member rejection, passive member acceptance, snapshot immutability, and atomic lifecycle/event behavior.
- [ ] Implement service-side source resolution and narrow RPC.
- [ ] Run GREEN/full gate.
- [ ] Commit `feat: add atomic finding retest requests`.

---

### Task 5: Retest job attachment and authoritative finalization

**Files:**
- Modify: Phase 5B migration
- Modify: `lib/security-remediation/repository.ts`
- Modify: `lib/security-remediation/service.ts`
- Create: `tests/security-remediation/retest-finalization.test.ts`

**Interfaces:**

```ts
markRetestRunning(input: {
  workspaceId: string;
  retestId: string;
  scanJobId: string;
  actorId: string;
}): Promise<SecurityFindingRetestRow>;

finalizeRetest(input: {
  workspaceId: string;
  retestId: string;
}): Promise<SecurityFindingRetestRow>;
```

`finalize_security_finding_retest` derives the result from locked database state; callers do not supply a desired terminal status.

- [ ] RED tests must prove:
  - exact job/workspace/asset match;
  - running attachment is one-way;
  - succeeded job + target occurrence -> `still_present`;
  - succeeded exact-source/profile job + no target occurrence + lifecycle still `retest_pending` -> `verified_fixed` and lifecycle transition;
  - failed job -> `failed` without `verified_fixed`;
  - blocked job -> `inconclusive` without `verified_fixed`;
  - cancelled job -> `cancelled` without `verified_fixed`;
  - lifecycle changed by concurrent recurrence -> finalizer cannot mark fixed;
  - later recurrence can reopen an already `verified_fixed` finding through existing Phase 5A ingestion.
- [ ] Implement row locks and derived finalization.
- [ ] Run GREEN/full gate.
- [ ] Commit `feat: add authoritative retest finalization`.

---

### Task 6: Reuse existing runtime execution services without duplicating network authority

**Files:**
- Create: `lib/runtime-observations/server-dependencies.ts`
- Create: `lib/active-validation/server-dependencies.ts`
- Modify: `app/dashboard/assets/[assetId]/runtime-actions.ts`
- Modify: `app/dashboard/assets/[assetId]/active-validation-actions.ts`
- Modify: `lib/security-remediation/service.ts`
- Create: `tests/security-remediation/retest-execution.test.ts`
- Modify relevant action/service tests.

**Interfaces:**

```ts
export function createRuntimeObservationServerDependencies(): RuntimeObservationServiceDependencies;
export function createActiveValidationServerDependencies(): ActiveValidationServiceDependencies;
```

Retest execution sequence is exact:

```text
request retest transaction
-> enqueueRuntimeObservation/enqueueActiveValidation
-> markRetestRunning(retestId, queued.job.id)
-> executeRuntimeObservation/executeActiveValidation
-> finalizeRetest(retestId)
```

Use fixed budgets from the existing packages.

- [ ] RED tests verify passive retest calls only the passive service, active retest calls only active service, active consent propagates only as the existing boolean, `markRetestRunning` occurs after enqueue and before execute, and finalization occurs after execution.
- [ ] Extract the two existing server dependency factories without changing their authorization behavior.
- [ ] Implement `executeFindingRetest` using injected/existing services; no URL/method/header/body/profile/budget browser input.
- [ ] Run GREEN/full gate.
- [ ] Commit `feat: execute finding retests through existing runtime services`.

---

### Task 7: Deterministic Security Story v1

**Files:**
- Create: `lib/security-remediation/story.ts`
- Modify: `lib/security-remediation/types.ts`
- Create: `tests/security-remediation/story.test.ts`

**Interfaces:**

```ts
export interface SecurityStoryV1 {
  summary: string;
  evidence: readonly SecurityStoryEvidenceItem[];
  impact: string;
  remediation: SecurityStoryRemediation;
  verification: SecurityStoryVerification;
}

export function buildSecurityStoryV1(input: SecurityStoryInput): SecurityStoryV1;
```

- [ ] RED tests verify provenance labels, bounded evidence, no raw headers/body fields, remediation assignment/note integration, and that wording says “verified fixed” only when canonical lifecycle and latest authoritative retest are both `verified_fixed`.
- [ ] Implement as a pure function with no database/network/provider imports.
- [ ] Run GREEN/typecheck.
- [ ] Commit `feat: add deterministic security story v1`.

---

### Task 8: Server actions and finding-detail workflow UI

**Files:**
- Create: `app/dashboard/findings/[findingId]/remediation-actions.ts`
- Create: `components/findings/FindingRemediationPanel.tsx`
- Create: `components/findings/FindingRetestPanel.tsx`
- Create: `components/findings/SecurityStoryPanel.tsx`
- Modify: `app/dashboard/findings/[findingId]/page.tsx`
- Modify: `lib/security-findings/repository.ts` only if needed to compose bounded detail data.
- Create: `tests/security-remediation/action-boundary.test.ts`
- Create component tests for the three panels.

**Server actions:**

```ts
updateFindingRemediationAction(
  findingId: string,
  assigneeUserId: string | null,
  remediationNote: string | null,
)

runFindingRetestAction(
  findingId: string,
  explicitConsent: boolean,
)
```

No action accepts URL, target, method, headers, body, source ID, profile ID/version, budget, scan job ID, desired retest status, or lifecycle target.

- [ ] RED boundary/component tests first.
- [ ] Implement safe action failure mapping and route revalidation.
- [ ] UI displays assignment/note, Security Story v1, 50-row retest history, passive retest button or active explicit-consent control only when supported/resolved.
- [ ] Run GREEN/full gate.
- [ ] Commit `feat: add remediation retest and security story UI`.

---

### Task 9: Architecture and security regression guards

**Files:**
- Create: `tests/architecture/security-remediation-dependencies.test.ts`
- Extend: `tests/security-remediation/migration.test.ts`
- Extend action-boundary and retest-finalization tests.

- [ ] RED guards prove:
  - `lib/security-remediation` cannot import `packages/runtime-network`;
  - runtime packages cannot import `lib/security-remediation`;
  - `story.ts` has no Supabase/Next/React/runtime imports;
  - only remediation repository/server wiring imports the new mutation RPC names;
  - authenticated browser roles have SELECT-only workflow table access;
  - every mutation function is `SECURITY DEFINER`, pins empty search path, revokes public/anon/authenticated, grants only service role;
  - no raw response body, cookie value, Authorization, credential, arbitrary header, URL/method/body request fields are added to Phase 5B tables.
- [ ] Implement/fix only what the guards expose.
- [ ] Run full gate.
- [ ] Commit `test: harden Phase 5B security boundaries`.

---

### Task 10: Permanent docs, security diff review, exact-head gate, merge, and production migration

**Files:**
- Modify: `docs/PHASES.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`

- [ ] Complete changed-file security diff review before freezing the code head.
- [ ] Fix every reportable finding test-first.
- [ ] Update docs to record Phase 5B scope, exact security boundaries, verified checkpoint, and next roadmap slice.
- [ ] Confirm the docs tail changes documentation only after the final reviewed code checkpoint.
- [ ] Run exact final head gate:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

- [ ] Confirm exact PR head matches the green workflow, mergeable state is true, and no unresolved review threads/blocking reviews exist.
- [ ] Squash-merge with `expected_head_sha`.
- [ ] Reconcile live Supabase schema in order: merged Phase 4C -> merged Phase 5A -> merged Phase 5B. Do not apply Phase 5B before its PR is merged.
- [ ] Run Supabase security and performance advisors after DDL and verify the expected workflow tables/RPCs exist.
