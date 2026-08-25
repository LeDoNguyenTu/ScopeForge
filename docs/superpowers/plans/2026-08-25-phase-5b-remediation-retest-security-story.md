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
- Produces tables `security_finding_work` and `security_finding_retests` only.
- Produces row/insert/update TypeScript types for those tables.
- Mutation RPCs are not introduced until Tasks 3-5, where their real behavior is defined by RED tests.

- [ ] **Step 1: Write failing migration contract tests**

```ts
expect(sql).toContain("create table public.security_finding_work");
expect(sql).toContain("create table public.security_finding_retests");
expect(sql).toContain("security_finding_retests_one_active_per_finding");
expect(sql).toContain("grant select on table public.security_finding_work to authenticated");
expect(sql).toContain("grant select on table public.security_finding_retests to authenticated");
expect(sql).not.toMatch(/grant\s+(?:insert|update|delete).*security_finding_(?:work|retests).*authenticated/is);
```

Also assert workspace/finding/asset foreign keys, 2000-character note bound, active/passive snapshot checks, immutable retest snapshot trigger, terminal timestamp rules, 50-row supporting index, RLS, and the five new event types.

- [ ] **Step 2: Run RED**

Run `npm test -- tests/security-remediation/migration.test.ts`.

Expected: migration file missing.

- [ ] **Step 3: Implement schema and types**

Create the two tables, constraints, indexes, SELECT-only RLS policies/grants, immutable snapshot trigger, and event-type constraint extension. Add matching generated-equivalent TypeScript table types.

- [ ] **Step 4: Run GREEN**

Run the migration test, `npm run typecheck`, and the complete repository gate.

- [ ] **Step 5: Commit**

Commit `feat: add Phase 5B workflow schema`.

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

Mappings are closed:

```text
scopeforge:runtime-observer -> passive_runtime
scopeforge:runtime-validator + cors-origin-policy@1 -> active_validation
```

- [ ] Write tests proving known sources resolve, unknown/external/advisory/user-confirmed sources do not, and descriptors expose no target URL/method/header/body/budget.
- [ ] Run RED.
- [ ] Implement the minimal registry and stable remediation/retest error types.
- [ ] Run GREEN and typecheck.
- [ ] Commit `feat: add closed retest source registry`.

---

### Task 3: Remediation assignment and note transaction

**Files:**
- Modify: `supabase/migrations/20260825090000_phase_5b_remediation_retest_security_story.sql`
- Modify: `lib/database.types.ts`
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

- [ ] RED tests: viewer rejection, member self-assignment only, owner/admin assignment to a current workspace member, invalid assignee rejection, 2001-character note rejection, safe errors, and append-only assignment/note events.
- [ ] Implement `change_security_finding_work` as `SECURITY DEFINER`, pinned empty search path, service-role-only EXECUTE, independent DB membership/role recheck, finding/work row lock, upsert, and events.
- [ ] Add RPC types, repository, and service.
- [ ] Run full GREEN gate.
- [ ] Commit `feat: add trusted remediation work tracking`.

---

### Task 4: Atomic retest request and `resolved -> retest_pending`

**Files:**
- Modify: Phase 5B migration
- Modify: `lib/database.types.ts`
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

The request RPC atomically locks the finding, requires `resolved`, prevents another non-terminal retest, inserts the immutable source/profile snapshot, transitions `resolved -> retest_pending`, and appends `finding.retest_requested`.

- [ ] RED tests: non-resolved rejection, unsupported source, active consent missing, active member rejection, passive member acceptance, immutable snapshots, one-active-retest constraint, and atomic lifecycle/event state.
- [ ] Implement service source resolution and `request_security_finding_retest`.
- [ ] Add RPC types/repository call.
- [ ] Run full GREEN gate.
- [ ] Commit `feat: add atomic finding retest requests`.

---

### Task 5: Retest job attachment and authoritative finalization

**Files:**
- Modify: Phase 5B migration
- Modify: `lib/database.types.ts`
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

`finalize_security_finding_retest` derives the terminal outcome from locked database state; callers cannot provide a desired terminal status.

- [ ] RED tests prove exact job/workspace/asset binding, one-way running attachment, succeeded job + target occurrence -> `still_present`, succeeded exact-source/profile job + no target occurrence + lifecycle still `retest_pending` -> retest `verified_fixed` and finding `verified_fixed`, failed -> `failed`, blocked -> `inconclusive`, cancelled -> `cancelled`, and concurrent recurrence prevents stale fixed finalization.
- [ ] Implement `mark_security_finding_retest_running` and `finalize_security_finding_retest` with row locks, service-role-only privileges, and bounded events/result codes.
- [ ] Add RPC types/repository methods.
- [ ] Run full GREEN gate.
- [ ] Commit `feat: add authoritative retest finalization`.

---

### Task 6: Reuse existing runtime services without duplicating request authority

**Files:**
- Create: `lib/runtime-observations/server-dependencies.ts`
- Create: `lib/active-validation/server-dependencies.ts`
- Modify: `app/dashboard/assets/[assetId]/runtime-actions.ts`
- Modify: `app/dashboard/assets/[assetId]/active-validation-actions.ts`
- Modify: `lib/security-remediation/service.ts`
- Create: `tests/security-remediation/retest-execution.test.ts`
- Modify existing runtime/active action tests that assert dependency wiring.

**Interfaces:**

```ts
export function createRuntimeObservationServerDependencies(): RuntimeObservationServiceDependencies;
export function createActiveValidationServerDependencies(): ActiveValidationServiceDependencies;
```

Exact retest sequence:

```text
requestFindingRetest
-> enqueueRuntimeObservation OR enqueueActiveValidation
-> markRetestRunning(retestId, queued.job.id)
-> executeRuntimeObservation OR executeActiveValidation
-> finalizeRetest(retestId)
```

- [ ] RED tests verify passive uses only passive service, active uses only active service, active explicit consent flows only into `enqueueActiveValidation`, fixed existing budgets are used, mark-running is after enqueue and before execute, and finalize is after execution.
- [ ] Extract the two existing server dependency factories without authorization behavior changes.
- [ ] Implement `executeFindingRetest` with injected existing executors and fixed budgets.
- [ ] Run full GREEN gate.
- [ ] Commit `feat: execute finding retests through existing runtime services`.

---

### Task 7: Deterministic Security Story v1

**Files:**
- Modify: `lib/security-remediation/types.ts`
- Create: `lib/security-remediation/story.ts`
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

- [ ] RED tests verify provenance labels, bounded evidence, no raw response fields, current assignment/note integration, and that `verified fixed` wording appears only when canonical lifecycle and latest authoritative retest are both `verified_fixed`.
- [ ] Implement as a pure function with no database/network/framework/provider imports.
- [ ] Run GREEN/typecheck/full gate.
- [ ] Commit `feat: add deterministic security story v1`.

---

### Task 8: Bounded workflow read model, server actions, and finding-detail UI

**Files:**
- Modify: `lib/security-findings/repository.ts`
- Create: `app/dashboard/findings/[findingId]/remediation-actions.ts`
- Create: `components/findings/FindingRemediationPanel.tsx`
- Create: `components/findings/FindingRetestPanel.tsx`
- Create: `components/findings/SecurityStoryPanel.tsx`
- Modify: `app/dashboard/findings/[findingId]/page.tsx`
- Create: `tests/security-remediation/read-model.test.ts`
- Create: `tests/security-remediation/action-boundary.test.ts`
- Create component tests for the three panels.

**Read-model interface:**

```ts
loadWorkspaceFindingWorkflowDetail(
  workspaceId: string,
  findingId: string,
): Promise<{
  work: SecurityFindingWorkRow | null;
  retests: SecurityFindingRetestRow[];
}>;
```

Retests are ordered newest-first and limited to 50.

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

No action accepts URL, target, method, headers, body, source/profile, budget, scan job ID, desired retest result, or generic lifecycle target.

- [ ] Write RED read/action/component tests.
- [ ] Implement bounded workflow read, safe action failure mapping, route revalidation, remediation controls, Security Story panel, retest controls/history, and active consent UI only for supported resolved active findings.
- [ ] Run full GREEN gate.
- [ ] Commit `feat: add remediation retest and security story UI`.

---

### Task 9: Architecture and security regression guards

**Files:**
- Create: `tests/architecture/security-remediation-dependencies.test.ts`
- Extend: `tests/security-remediation/migration.test.ts`
- Extend: `tests/security-remediation/action-boundary.test.ts`
- Extend: `tests/security-remediation/retest-finalization.test.ts`

- [ ] RED guards enforce: remediation code cannot import `packages/runtime-network`; runtime packages cannot import remediation; `story.ts` has no Supabase/Next/React/runtime import; authenticated browser roles remain SELECT-only; every mutation RPC is `SECURITY DEFINER`, `set search_path = ''`, revoked from public/anon/authenticated and granted only to service role; Phase 5B schema contains no raw response-body/cookie/Authorization/credential/arbitrary-header/URL/method/body request fields.
- [ ] Fix only what the guards expose.
- [ ] Run full GREEN gate.
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

- [ ] Complete the full changed-file security diff review before freezing code.
- [ ] Fix every reportable finding test-first.
- [ ] Update permanent docs with the verified code checkpoint and Phase 5B boundary.
- [ ] Confirm the final tail after the reviewed code checkpoint is documentation-only.
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

- [ ] Confirm exact PR head equals the green workflow head, mergeable is true, and no unresolved review threads/blocking reviews exist.
- [ ] Squash-merge with `expected_head_sha`.
- [ ] Reconcile live Supabase schema in order: merged Phase 4C -> merged Phase 5A -> merged Phase 5B. Do not apply Phase 5B before its PR is merged.
- [ ] Run Supabase security and performance advisors after DDL and verify expected tables/RPCs exist.