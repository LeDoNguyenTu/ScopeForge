# Phase 5A Hosted Finding Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist canonical runtime `SecurityFinding` and `EvidenceRecord` objects as a workspace-scoped hosted ledger with idempotent occurrence history, trusted lifecycle workflow, and bounded findings list/detail views.

**Architecture:** Keep `packages/security-domain` authoritative and framework-independent. Add `lib/security-findings` as the hosted application boundary and five workspace-scoped Supabase tables. Passive and active runtime results use separate service-role-only PostgreSQL RPCs so observations plus canonical findings/evidence commit atomically under the existing job lock; user lifecycle changes use a third narrow RPC so current state and history event also commit atomically.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, React, Supabase/PostgreSQL/RLS, `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-08-25-phase-5a-hosted-finding-foundation-design.md`

## Global Constraints

- `packages/security-domain` remains the canonical finding/evidence/lifecycle model.
- Phase 5A adds persistence/workflow only and must not widen network or scanner authority.
- Hosted ingestion accepts Phase 4B `passive_runtime` and Phase 4C-1 `active_validation` only.
- Phase 3 hosted import, external scanners, Security Stories/model calls, risk acceptance, false-positive workflow, retest orchestration, and workers remain out of scope.
- Browser roles receive SELECT only on all security ledger tables.
- Runtime evidence summary limit remains 4096 characters and may not contain raw response bodies, cookies, credentials, raw header maps, query strings/fragments, or unbounded errors.
- Durable identity is the existing domain string ID scoped by workspace.
- Disappearance from a later run never changes lifecycle automatically.
- Supported Phase 5A user actions are exactly: `open -> acknowledged`, `open -> in_progress`, `acknowledged -> in_progress`, `in_progress -> resolved`, `resolved -> in_progress`.
- `viewer` is read-only; `member`, `admin`, and `owner` may use those ordinary transitions through trusted server actions.
- Deterministic recurrence rules are exactly: `resolved -> in_progress`, `retest_pending -> in_progress`, `verified_fixed -> open`; `accepted_risk` and `false_positive` remain unchanged.
- Final exact head must pass `npm ci --ignore-scripts --no-audit --no-fund`, `npm test`, `npm run typecheck`, `npm run build:cli`, compiled CLI version smoke, `npm run benchmark:scanner`, and `npm run build`.

---

### Task 1: Harden durable deterministic identity and recurrence contract

**Files:**
- Modify: `packages/runtime-observer/domain-mapper.ts`
- Modify: `packages/security-domain/findings/lifecycle.ts`
- Modify: `tests/runtime-observer/runtime-finding-mapping.test.ts`
- Modify: `tests/security-domain/finding-lifecycle.test.ts`

**Interfaces:**
- Produces passive runtime finding/evidence digests that include `RUNTIME_SOURCE_VERSION`.
- Produces domain transition permission `verified_fixed -> open` for trusted deterministic recurrence.

- [ ] **Step 1: Add the RED passive identity test**

```ts
import { createHash } from "node:crypto";

it("includes source version in the durable runtime identity", () => {
  const match = evaluateRuntimeRules({
    observations: [header("strict-transport-security", false)],
  })[0];
  expect(match).toBeDefined();
  if (!match) return;

  const digest = createHash("sha256")
    .update("asset-1", "utf8")
    .update("\u0000", "utf8")
    .update(match.ruleId, "utf8")
    .update("\u0000", "utf8")
    .update("0.1", "utf8")
    .update("\u0000", "utf8")
    .update(match.observationKey, "utf8")
    .digest("hex");

  expect(mapRuntimeRuleMatchToSecurityFinding({ assetRef: runtimeAssetRef, match }).id)
    .toBe(`runtime:${digest}`);
  expect(mapRuntimeRuleMatchToEvidence({ assetRef: runtimeAssetRef, match }).id)
    .toBe(`runtime-evidence:${digest}`);
});
```

- [ ] **Step 2: Add the RED recurrence lifecycle test**

```ts
it("allows verified-fixed recurrence without reopening false positives", () => {
  expect(canTransitionFindingLifecycle("verified_fixed", "open")).toBe(true);
  expect(canTransitionFindingLifecycle("false_positive", "open")).toBe(false);
});
```

- [ ] **Step 3: Verify RED**

```bash
npm test -- tests/runtime-observer/runtime-finding-mapping.test.ts tests/security-domain/finding-lifecycle.test.ts
```

Expected: both new expectations fail.

- [ ] **Step 4: Implement the minimal changes**

In `stableRuntimeDigest`:

```ts
.update(match.ruleId, "utf8")
.update("\u0000", "utf8")
.update(RUNTIME_SOURCE_VERSION, "utf8")
.update("\u0000", "utf8")
.update(match.observationKey, "utf8")
```

In lifecycle transitions:

```ts
verified_fixed: ["open"],
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm test -- tests/runtime-observer/runtime-finding-mapping.test.ts tests/security-domain/finding-lifecycle.test.ts
git add packages/runtime-observer/domain-mapper.ts packages/security-domain/findings/lifecycle.ts tests/runtime-observer/runtime-finding-mapping.test.ts tests/security-domain/finding-lifecycle.test.ts
git commit -m "fix: harden durable finding identities"
```

---

### Task 2: Add five-table ledger schema, RLS, and immutable history

**Files:**
- Create: `supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql`
- Create: `tests/security-findings/migration.test.ts`
- Modify: `lib/database.types.ts`

**Interfaces:**
- Tables: `security_findings`, `security_evidence`, `security_finding_evidence`, `security_finding_occurrences`, `security_finding_events`.

- [ ] **Step 1: Write the RED migration tests**

```ts
const expectedTables = [
  "security_findings",
  "security_evidence",
  "security_finding_evidence",
  "security_finding_occurrences",
  "security_finding_events",
] as const;

it("creates one workspace-scoped finding ledger", async () => {
  const sql = await readFile(migrationPath, "utf8");
  for (const table of expectedTables) {
    expect(sql).toContain(`create table public.${table}`);
  }
  expect(sql).not.toMatch(/create table public\.(passive_findings|active_findings|runtime_findings)/i);
});

it("keeps authenticated users select-only", async () => {
  const sql = await readFile(migrationPath, "utf8");
  expect(sql.match(/grant select on table public\.security_/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  expect(sql).not.toMatch(/grant\s+(insert|update|delete)\s+on\s+table\s+public\.security_/i);
});
```

Also assert composite workspace foreign keys, occurrence uniqueness, bounded metadata/reason, and append-only trigger text `Finding history rows are append-only`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/security-findings/migration.test.ts
```

Expected: migration file is absent.

- [ ] **Step 3: Create `security_findings` and `security_evidence`**

Use text domain IDs and explicit bounds:

```sql
create table public.security_findings (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id text not null check (char_length(finding_id) between 1 and 256),
  asset_id uuid not null,
  source_kind text not null check (source_kind in ('deterministic-passive-scanner','deterministic-runtime-scanner','external-scanner','user-confirmed','advisory-inference')),
  source_id text not null check (char_length(source_id) between 1 and 256),
  source_version text check (source_version is null or char_length(source_version) <= 128),
  rule_ref text not null check (char_length(rule_ref) between 1 and 512),
  title text not null check (char_length(title) between 1 and 240),
  description text not null check (char_length(description) between 1 and 8192),
  severity text not null check (severity in ('critical','high','medium','low','info')),
  confidence text not null check (confidence in ('high','medium','low')),
  validation_state text not null check (validation_state in ('unvalidated','static_confirmed','runtime_observed','runtime_validated','user_confirmed')),
  provenance_kind text not null check (provenance_kind in ('observed','scanner-derived','user-confirmed','inferred')),
  location jsonb check (location is null or (jsonb_typeof(location)='object' and pg_column_size(location) <= 8192)),
  taxonomy jsonb not null check (jsonb_typeof(taxonomy)='object' and pg_column_size(taxonomy) <= 16384),
  remediation jsonb check (remediation is null or (jsonb_typeof(remediation)='object' and pg_column_size(remediation) <= 16384)),
  lifecycle_state text not null check (lifecycle_state in ('open','acknowledged','in_progress','resolved','retest_pending','verified_fixed','accepted_risk','false_positive')),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_seen_job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, finding_id),
  foreign key (asset_id, workspace_id) references public.assets(id, workspace_id) on delete cascade,
  foreign key (last_seen_job_id, workspace_id, asset_id) references public.scan_jobs(id, workspace_id, asset_id),
  check (first_seen_at <= last_seen_at)
);

create table public.security_evidence (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  evidence_id text not null check (char_length(evidence_id) between 1 and 256),
  asset_id uuid not null,
  kind text not null check (kind in ('repository-location','static-analysis','dependency','http-observation','tls-observation','user-confirmed','artifact-reference')),
  provenance_kind text not null check (provenance_kind in ('observed','scanner-derived','user-confirmed','inferred')),
  summary text not null check (char_length(summary) between 1 and 4096),
  classification text not null check (classification in ('public','internal','sensitive','secret')),
  artifact_ref text check (artifact_ref is null or char_length(artifact_ref) <= 1024),
  created_at timestamptz not null default now(),
  primary key (workspace_id, evidence_id),
  foreign key (asset_id, workspace_id) references public.assets(id, workspace_id) on delete cascade
);
```

- [ ] **Step 4: Create link, occurrence, and event history tables**

Occurrences must include `scan_job_id`, optional `scan_run_ref`, source snapshot, validation state, and:

```sql
unique (workspace_id, finding_id, scan_job_id)
```

Events must include actor type/id, optional scan job, event type, from/to lifecycle, bounded reason <= 1000, metadata object <= 8192 bytes. Add:

```sql
create unique index security_finding_events_scan_event_unique
  on public.security_finding_events(workspace_id, finding_id, scan_job_id, event_type)
  where scan_job_id is not null and actor_type = 'system';
```

- [ ] **Step 5: Add immutability, RLS, grants, and indexes**

Evidence, occurrence, and event rows reject UPDATE/DELETE. `security_findings` rejects changes to workspace/finding/asset/source identity fields. All five tables use workspace-member SELECT policies, revoke all from anon/authenticated, then grant SELECT to authenticated only.

- [ ] **Step 6: Extend `lib/database.types.ts` exactly to the new schema**

Add row/insert/update types for all tables and aliases for severity/confidence/validation/lifecycle strings.

- [ ] **Step 7: Verify and commit**

```bash
npm test -- tests/security-findings/migration.test.ts
npm run typecheck
git add supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql lib/database.types.ts tests/security-findings/migration.test.ts
git commit -m "feat: add hosted security finding ledger"
```

---

### Task 3: Add pure canonical ingestion validation and serialization

**Files:**
- Create: `lib/security-findings/types.ts`
- Create: `lib/security-findings/ingestion.ts`
- Create: `tests/security-findings/ingestion.test.ts`

**Interfaces:**

```ts
export interface FindingIngestionBatch {
  workspaceId: string;
  assetId: string;
  scanJobId: string;
  observedAt: Date;
  findings: readonly SecurityFinding[];
  evidence: readonly EvidenceRecord[];
}

export interface PreparedFindingIngestion {
  workspaceId: string;
  assetId: string;
  scanJobId: string;
  observedAt: string;
  findings: Json;
  evidence: Json;
}

export function prepareFindingIngestionBatch(input: FindingIngestionBatch): PreparedFindingIngestion;
```

- [ ] **Step 1: Write RED tests**

Tests must prove valid runtime records serialize and these inputs fail: wrong `assetRef`, missing referenced evidence, conflicting duplicate IDs, non-runtime source kind, non-scanner-derived finding provenance, secret/internal runtime evidence, non-observed evidence provenance, unsupported evidence kind, oversized IDs/text/JSON.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/security-findings/ingestion.test.ts
```

- [ ] **Step 3: Implement source-authority checks**

```ts
function assertRuntimeAuthority(finding: SecurityFinding): void {
  if (finding.source.kind !== "deterministic-runtime-scanner") {
    throw new Error("Phase 5A hosted ingestion accepts deterministic runtime findings only.");
  }
  if (finding.provenance.kind !== "scanner-derived") {
    throw new Error("Runtime finding provenance must be scanner-derived.");
  }
  if (finding.validation !== "runtime_observed" && finding.validation !== "runtime_validated") {
    throw new Error("Runtime validation state is incompatible with hosted ingestion.");
  }
}
```

Runtime evidence must be `classification === "public"`, `provenance.kind === "observed"`, and kind `http-observation` or `tls-observation`.

- [ ] **Step 4: Serialize bounded rows**

Serialize finding fields except lifecycle authority; new lifecycle starts as `open` in SQL and existing lifecycle is preserved. Include `scan_run_ref` in the finding JSON only so SQL can copy it into the occurrence; do not store it in `security_findings`.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- tests/security-findings/ingestion.test.ts
git add lib/security-findings tests/security-findings/ingestion.test.ts
git commit -m "feat: validate hosted finding ingestion"
```

---

### Task 4: Add atomic runtime result transactions and idempotent ledger ingestion

**Files:**
- Modify: `supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql`
- Modify: `lib/database.types.ts`
- Create: `tests/security-findings/result-transaction.test.ts`

**Interfaces:**
- `private.ingest_security_finding_batch(...)`
- `public.persist_passive_runtime_result(...)`
- `public.persist_active_validation_result(...)`

- [ ] **Step 1: Write RED SQL-boundary tests**

Require both public functions, `FOR UPDATE` on the exact job, `running` and `cancel_requested_at is null` validation, exact job-kind validation, use of `private.ingest_security_finding_batch`, grants only to `service_role`, and no authenticated EXECUTE grant.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/security-findings/result-transaction.test.ts
```

- [ ] **Step 3: Implement `private.ingest_security_finding_batch`**

For every batch, in the same transaction:

1. Insert immutable evidence idempotently; compare existing content and raise `EVIDENCE_ID_CONFLICT` if one evidence ID maps to different content.
2. Lock existing finding row when present and reject workspace/asset/source/rule identity drift.
3. Insert new finding with lifecycle `open`, or refresh scanner-derived descriptive fields while preserving human lifecycle except approved recurrence.
4. Insert finding/evidence links idempotently.
5. Insert occurrence with `ON CONFLICT DO NOTHING`.
6. Emit observation event only when that occurrence was newly inserted.
7. Emit `finding.reopened` only when recurrence changed lifecycle.
8. Never move `last_seen_at` backwards on an older retry.

Exact recurrence mapping:

```sql
case existing_lifecycle
  when 'resolved' then 'in_progress'
  when 'retest_pending' then 'in_progress'
  when 'verified_fixed' then 'open'
  else existing_lifecycle
end
```

- [ ] **Step 4: Implement passive and active result RPCs**

Each must lock exactly `(job id, workspace id, asset id)`, reject non-running/cancelled jobs, validate job kind, insert bounded runtime observation row(s), then invoke the private ledger helper before returning. Use `security definer set search_path = ''`, revoke from public/anon/authenticated, grant only to service_role.

- [ ] **Step 5: Add exact Supabase function typings**

Add the three JSON/timestamp/id argument sets to `Database["public"]["Functions"]` using the repository's generated-type convention.

- [ ] **Step 6: Verify and commit**

```bash
npm test -- tests/security-findings/migration.test.ts tests/security-findings/result-transaction.test.ts
npm run typecheck
git add supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql lib/database.types.ts tests/security-findings/result-transaction.test.ts
git commit -m "feat: add atomic runtime finding persistence"
```

---

### Task 5: Integrate active and passive Phase 4 services with the atomic result RPCs

**Files:**
- Modify: `lib/active-validation/repository.ts`
- Modify: `lib/active-validation/service.ts`
- Modify: `lib/runtime-observations/repository.ts`
- Modify: `lib/runtime-observations/service.ts`
- Modify: `tests/runtime-validator/repository.test.ts`
- Modify: `tests/runtime-validator/service.test.ts`
- Modify: `tests/runtime-observations/repository.test.ts`
- Modify: `tests/runtime-observations/service.test.ts`
- Create: `tests/security-findings/runtime-integration.test.ts`

**Interfaces:**

Active repository:

```ts
persistResult(
  job: ScanJobRow,
  observation: CorsPolicyObservation,
  findings: readonly SecurityFinding[],
  evidence: readonly EvidenceRecord[],
  maximumObservationBytes: number,
  observedAt: Date,
): Promise<void>
```

Passive repository:

```ts
persistResult(
  job: ScanJobRow,
  observations: readonly RuntimeObservation[],
  findings: readonly SecurityFinding[],
  evidence: readonly EvidenceRecord[],
  maximumObservationBytes: number,
  observedAt: Date,
): Promise<void>
```

- [ ] **Step 1: Write RED active/passive integration tests**

Require each repository to call only its narrow RPC, never write security tables directly, and require services to pass mapped findings/evidence into `persistResult` before `markSucceeded`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/runtime-validator/repository.test.ts tests/runtime-validator/service.test.ts tests/runtime-observations/repository.test.ts tests/runtime-observations/service.test.ts tests/security-findings/runtime-integration.test.ts
```

- [ ] **Step 3: Implement active `persistResult`**

Normalize the CORS observation, call `prepareFindingIngestionBatch`, then call `persist_active_validation_result` with the job/workspace/asset ids, prepared JSON, and `observedAt`.

- [ ] **Step 4: Implement passive `persistResult`**

Normalize observation rows, call `prepareFindingIngestionBatch`, then call `persist_passive_runtime_result` with the same trusted identifiers.

- [ ] **Step 5: Preserve cancellation semantics in both services**

Keep all existing pre-network, post-network, pre-rule, and pre-persistence cancellation checks. SQL remains the final race-closing check. A persistence failure caused by an observed cancellation maps to cancelled; all other failures use existing stable execution failure codes. Never re-run network I/O merely to recreate ledger rows after a committed result transaction.

- [ ] **Step 6: Verify and commit**

```bash
npm test -- tests/runtime-validator tests/runtime-observations tests/security-findings/runtime-integration.test.ts
npm run typecheck
git add lib/active-validation lib/runtime-observations tests/runtime-validator tests/runtime-observations tests/security-findings/runtime-integration.test.ts
git commit -m "feat: persist runtime findings atomically"
```

---

### Task 6: Add atomic trusted lifecycle workflow

**Files:**
- Modify: `supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql`
- Modify: `lib/database.types.ts`
- Create: `lib/security-findings/repository.ts`
- Create: `lib/security-findings/service.ts`
- Create: `tests/security-findings/repository.test.ts`
- Create: `tests/security-findings/service.test.ts`
- Create: `app/dashboard/findings/[findingId]/actions.ts`
- Create: `tests/security-findings/action-boundary.test.ts`

**Interfaces:**

```ts
export type Phase5ALifecycleAction = "acknowledge" | "start_work" | "resolve" | "reopen";

export interface ChangeFindingLifecycleInput {
  actorId: string | null;
  workspaceId: string;
  role: WorkspaceRole | null;
  findingId: string;
  action: Phase5ALifecycleAction;
  note?: string;
}
```

Database RPC:

```sql
public.change_security_finding_lifecycle(
  target_workspace_id uuid,
  target_finding_id text,
  expected_lifecycle text,
  next_lifecycle text,
  target_actor_id uuid,
  event_reason text
)
```

- [ ] **Step 1: Write RED authorization and SQL-atomicity tests**

Prove viewer rejected; member/admin/owner limited to exact Phase 5A actions; resolve and reopen require non-empty <=1000 character note/reason; unsupported target states cannot enter through action input. Migration test must require the lifecycle RPC to `SELECT ... FOR UPDATE`, update the current row, and insert `finding.lifecycle_changed` in the same function. Grant EXECUTE only to service_role.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/security-findings/repository.test.ts tests/security-findings/service.test.ts tests/security-findings/action-boundary.test.ts tests/security-findings/migration.test.ts
```

- [ ] **Step 3: Implement the lifecycle RPC**

The function locks `(workspace_id, finding_id)`, verifies `lifecycle_state = expected_lifecycle`, checks the exact allowed Phase 5A transition pairs, updates the row, inserts one append-only user `finding.lifecycle_changed` event, and returns the updated row. It does not accept risk/false-positive/retest/verified-fixed targets.

- [ ] **Step 4: Implement repository and service**

Repository calls only `change_security_finding_lifecycle`; service maps action to target state, uses `canTransitionFindingLifecycle`, enforces role and note rules, and does not accept a generic `toLifecycle` string.

- [ ] **Step 5: Implement dedicated server action**

`changeFindingLifecycleAction(findingId, action, note)` loads `getDashboardContext()`, constructs trusted service dependencies using `createAdminClient()`, revalidates findings list/detail paths, and returns bounded error codes/messages.

- [ ] **Step 6: Verify and commit**

```bash
npm test -- tests/security-findings
npm run typecheck
git add supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql lib/database.types.ts lib/security-findings app/dashboard/findings tests/security-findings
git commit -m "feat: add trusted finding lifecycle workflow"
```

---

### Task 7: Add workspace-scoped findings list/detail UI

**Files:**
- Extend: `lib/security-findings/repository.ts`
- Create: `app/dashboard/findings/page.tsx`
- Create: `app/dashboard/findings/[findingId]/page.tsx`
- Create: `components/findings/FindingLifecycleControls.tsx`
- Modify: `components/SideNav.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/globals.css`
- Create: `tests/security-findings/read-model.test.ts`
- Create: `tests/components/FindingLifecycleControls.test.tsx`

**Interfaces:**

```ts
listWorkspaceFindings(workspaceId: string): Promise<SecurityFindingRow[]>;
loadWorkspaceFindingDetail(workspaceId: string, findingId: string): Promise<{
  finding: SecurityFindingRow;
  evidence: SecurityEvidenceRow[];
  occurrences: SecurityFindingOccurrenceRow[];
  events: SecurityFindingEventRow[];
} | null>;
```

- [ ] **Step 1: Write RED read-model/UI tests**

Require every query to filter workspace, list sort `last_seen_at desc`, viewer no mutation controls, no risk/false-positive/retest/verified-fixed buttons, and note field required for resolve/reopen.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/security-findings/read-model.test.ts tests/components/FindingLifecycleControls.test.tsx
```

- [ ] **Step 3: Implement list and detail**

Use the authenticated dashboard Supabase client for SELECT-only RLS reads. List displays title, asset, severity, confidence, validation, lifecycle, source, first/last seen. Detail adds description, rule, taxonomy, remediation, evidence summaries/classifications, occurrence history, and lifecycle history. Never render raw JSON blobs directly.

- [ ] **Step 4: Implement lifecycle controls**

Use this exact action availability:

```ts
const actionsByState = {
  open: ["acknowledge", "start_work"],
  acknowledged: ["start_work"],
  in_progress: ["resolve"],
  resolved: ["reopen"],
} as const;
```

All other lifecycle states are display-only in Phase 5A.

- [ ] **Step 5: Enable Findings navigation and real dashboard count**

Set SideNav Findings href to `/dashboard/findings` with prefix matching. Dashboard open-work count excludes `verified_fixed`, `accepted_risk`, and `false_positive`, and stale Phase 2-only wording is replaced with current runtime/findings copy.

- [ ] **Step 6: Verify UI/build and commit**

```bash
npm test -- tests/security-findings tests/components/FindingLifecycleControls.test.tsx
npm run typecheck
npm run build
git add app/dashboard components lib/security-findings tests app/globals.css
git commit -m "feat: add hosted findings views"
```

---

### Task 8: Add architecture/security guards

**Files:**
- Create: `tests/architecture/security-findings-dependencies.test.ts`
- Extend: `tests/security-findings/migration.test.ts`
- Extend runtime repository/service tests when needed.

- [ ] **Step 1: Write dependency guards**

`packages/security-domain` cannot import app/lib/Supabase/Next/React. Runtime packages cannot import `lib/security-findings`. `lib/security-findings/service.ts` and repository cannot import runtime-network/observer/validator; only pure ingestion serialization is imported from application runtime repositories.

- [ ] **Step 2: Add SQL security assertions**

Require SELECT-only authenticated grants, service-role-only RPC execution, append-only history, composite workspace/asset/job foreign keys, no body/raw-header columns, and no authenticated generic ingestion/lifecycle RPC.

- [ ] **Step 3: Run the focused security suite and commit**

```bash
npm test -- tests/architecture tests/security-findings tests/runtime-observations tests/runtime-validator
npm run typecheck
git add tests/architecture tests/security-findings
git commit -m "test: guard hosted finding boundaries"
```

---

### Task 9: Permanent docs, exact gate, security diff review, and merge

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PHASES.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`

- [ ] **Step 1: Update architecture and roadmap conservatively**

Document the durable ledger, trusted transactional result path, RLS SELECT-only UI, lifecycle authority, and explicit Phase 5B/5C non-goals. Before merge, state “implemented in PR #N, awaiting exact-head gate”, not complete.

- [ ] **Step 2: Run the full exact-head gate**

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Every command must exit 0 on the final unchanged PR head.

- [ ] **Step 3: Perform full security diff review**

Review every changed file for cross-workspace access, browser write authority, generic ingestion, scanner-driven lifecycle overwrite, advisory/inference promotion, disappearance-based closure, recurrence overreach, persistence/cancellation races, event duplication, secret evidence, and network-authority widening. Any plausible finding receives a failing regression before the fix.

- [ ] **Step 4: Check PR state**

Require no unresolved review threads, no blocking review, mergeable true, and full CI success on the exact current head. A head change invalidates earlier gate evidence.

- [ ] **Step 5: Squash merge with expected-head protection**

Merge only using the verified exact head SHA. If permanent docs still contain pre-merge wording afterward, use a docs-only follow-up PR and run the same exact-head gate before merging it.

## Self-Review Result

The implementation plan covers durable ID hardening, the five-table ledger, immutable evidence/history, RLS SELECT-only browser access, trusted runtime ingestion, idempotent occurrence/event behavior, atomic passive and active result persistence, cancellation ordering, limited lifecycle authority, deterministic recurrence, list/detail views, architecture guards, permanent docs, security review, and exact-head merge verification. All write paths have explicit transactional owners and there are no unresolved implementation choices in the plan.