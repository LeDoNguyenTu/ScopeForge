# Phase 5A Hosted Finding Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist canonical runtime `SecurityFinding` and `EvidenceRecord` objects as a workspace-scoped hosted finding ledger with idempotent occurrence history, trusted lifecycle workflow, and bounded findings list/detail views.

**Architecture:** Keep `packages/security-domain` authoritative and framework-independent. Add `lib/security-findings` as the trusted hosted application layer, five workspace-scoped Supabase ledger tables, and two narrow trusted PostgreSQL result RPCs so Phase 4 runtime observations plus canonical findings/evidence commit atomically under the existing job/cancellation lock. Browser clients receive RLS-protected SELECT access only; lifecycle writes go through dedicated server actions and trusted repository methods.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, React, Supabase/PostgreSQL/RLS, `@supabase/supabase-js`, existing ScopeForge security-domain/runtime packages.

**Spec:** `docs/superpowers/specs/2026-08-25-phase-5a-hosted-finding-foundation-design.md`

## Global Constraints

- Existing `packages/security-domain` contracts remain authoritative; do not create a second finding model.
- Phase 5A adds persistence/workflow only; it must not widen scanner or network authority.
- First hosted ingestion sources are Phase 4B `passive_runtime` and Phase 4C-1 `active_validation` only.
- Local Phase 3 hosted import remains out of scope.
- Durable finding/evidence identities are existing domain string IDs scoped by workspace; do not introduce public UUID aliases.
- Runtime evidence summaries remain bounded to 4 KiB and must not persist raw response bodies, cookies, credentials, raw headers, URL queries/fragments, or unbounded exception text.
- Browser roles receive SELECT only on security ledger tables.
- Trusted runtime result persistence must remain cancellation-safe and all-or-nothing.
- Absence from a later scan never implies remediation or `verified_fixed`.
- Phase 5A UI exposes only `open -> acknowledged`, `open -> in_progress`, `acknowledged -> in_progress`, `in_progress -> resolved`, and `resolved -> in_progress`.
- `viewer` is read-only. `member`, `admin`, and `owner` may perform Phase 5A ordinary lifecycle transitions through trusted server actions.
- `accepted_risk`, `false_positive`, `retest_pending`, and manual `verified_fixed` actions remain unavailable in Phase 5A.
- Re-observation rules: `resolved -> in_progress`, `retest_pending -> in_progress`, `verified_fixed -> open`; `accepted_risk` and `false_positive` remain unchanged.
- Exact final merge head must pass: `npm ci --ignore-scripts --no-audit --no-fund`, `npm test`, `npm run typecheck`, `npm run build:cli`, `node .scopeforge-build/packages/cli/index.js version`, `npm run benchmark:scanner`, `npm run build`.

---

## File Structure

New application files:

- `lib/security-findings/types.ts` - trusted ingestion/lifecycle/read-model types.
- `lib/security-findings/ingestion.ts` - pure validation and bounded serialization of canonical domain records.
- `lib/security-findings/repository.ts` - trusted Supabase repository for reads, lifecycle transitions, and narrow runtime result RPC calls.
- `lib/security-findings/service.ts` - lifecycle authorization, recurrence decisions, read-model orchestration, and audit event contracts.
- `app/dashboard/findings/page.tsx` - workspace findings list.
- `app/dashboard/findings/[findingId]/page.tsx` - finding detail.
- `app/dashboard/findings/[findingId]/actions.ts` - dedicated lifecycle mutations.
- `components/findings/FindingLifecycleControls.tsx` - bounded interactive lifecycle form.
- `tests/security-findings/*` - ingestion, repository, service, migration, and UI tests.
- `supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql` - ledger schema, RLS, immutable/append-only guards, internal ingestion helper, and narrow runtime-result RPCs.

Existing files changed:

- `packages/runtime-observer/domain-mapper.ts` - include source version in stable passive-runtime identity.
- `packages/security-domain/findings/lifecycle.ts` - permit only the narrow domain transition `verified_fixed -> open` needed for trusted deterministic recurrence.
- `lib/runtime-observations/repository.ts` / `service.ts` - persist passive observations and canonical ledger results atomically.
- `lib/active-validation/repository.ts` / `service.ts` - persist CORS observation and canonical ledger results atomically.
- `lib/database.types.ts` - generated-equivalent table/function typing for the migration.
- `components/SideNav.tsx` - enable `/dashboard/findings`.
- `app/dashboard/page.tsx` - use real open finding count and current Phase 5 wording.
- `app/globals.css` - findings list/detail/control styles.
- architecture/development docs and tests.

---

### Task 1: Harden deterministic identities before persistence

**Files:**
- Modify: `packages/runtime-observer/domain-mapper.ts`
- Modify: `packages/security-domain/findings/lifecycle.ts`
- Modify: `tests/runtime-observer/runtime-finding-mapping.test.ts`
- Modify: `tests/security-domain/finding-lifecycle.test.ts`

**Interfaces:**
- Consumes: existing `RuntimeRuleMatch`, `SecurityFinding`, `EvidenceRecord`, `FindingLifecycleState`.
- Produces: passive runtime finding/evidence IDs whose digest includes `RUNTIME_SOURCE_VERSION`; domain recurrence transition `verified_fixed -> open`.

- [ ] **Step 1: Write the passive identity regression**

Add a SHA-256 expectation to `runtime-finding-mapping.test.ts` using the current version `0.1`:

```ts
import { createHash } from "node:crypto";

it("includes the runtime source version in durable finding identity", () => {
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

  const finding = mapRuntimeRuleMatchToSecurityFinding({ assetRef: runtimeAssetRef, match });
  const evidence = mapRuntimeRuleMatchToEvidence({ assetRef: runtimeAssetRef, match });

  expect(finding.id).toBe(`runtime:${digest}`);
  expect(evidence.id).toBe(`runtime-evidence:${digest}`);
});
```

- [ ] **Step 2: Write recurrence lifecycle regression**

Change the terminal-state test so only verified-fixed may reopen:

```ts
it("allows trusted deterministic recurrence to reopen verified fixed only", () => {
  expect(canTransitionFindingLifecycle("verified_fixed", "open")).toBe(true);
  expect(canTransitionFindingLifecycle("false_positive", "open")).toBe(false);
});
```

- [ ] **Step 3: Run the focused tests and confirm RED**

Run:

```bash
npm test -- tests/runtime-observer/runtime-finding-mapping.test.ts tests/security-domain/finding-lifecycle.test.ts
```

Expected: passive ID expectation fails because `RUNTIME_SOURCE_VERSION` is absent from `stableRuntimeDigest`; lifecycle expectation fails because `verified_fixed` has no outgoing transition.

- [ ] **Step 4: Implement the minimal identity/lifecycle changes**

In `stableRuntimeDigest` insert the version between rule ID and observation key:

```ts
.update(match.ruleId, "utf8")
.update("\u0000", "utf8")
.update(RUNTIME_SOURCE_VERSION, "utf8")
.update("\u0000", "utf8")
.update(match.observationKey, "utf8")
```

In `ALLOWED_TRANSITIONS`:

```ts
verified_fixed: ["open"],
```

Do not change `false_positive` or `accepted_risk` transitions.

- [ ] **Step 5: Re-run focused tests and commit**

```bash
npm test -- tests/runtime-observer/runtime-finding-mapping.test.ts tests/security-domain/finding-lifecycle.test.ts
git add packages/runtime-observer/domain-mapper.ts packages/security-domain/findings/lifecycle.ts tests/runtime-observer/runtime-finding-mapping.test.ts tests/security-domain/finding-lifecycle.test.ts
git commit -m "fix: harden durable finding identities"
```

---

### Task 2: Add the canonical hosted ledger schema and RLS

**Files:**
- Create: `supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql`
- Create: `tests/security-findings/migration.test.ts`
- Modify: `lib/database.types.ts`

**Interfaces:**
- Produces tables: `security_findings`, `security_evidence`, `security_finding_evidence`, `security_finding_occurrences`, `security_finding_events`.
- Produces browser SELECT-only RLS and service-role-only mutation boundary.

- [ ] **Step 1: Write schema/RLS tests first**

Create `tests/security-findings/migration.test.ts` with explicit assertions:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql",
);

async function migrationSql() {
  return readFile(migrationPath, "utf8");
}

describe("Phase 5A hosted finding migration", () => {
  it("creates one canonical workspace-scoped ledger", async () => {
    const sql = await migrationSql();
    for (const table of [
      "security_findings",
      "security_evidence",
      "security_finding_evidence",
      "security_finding_occurrences",
      "security_finding_events",
    ]) {
      expect(sql).toContain(`create table public.${table}`);
    }
    expect(sql).not.toMatch(/create table public\.(runtime_findings|active_findings|passive_findings)/i);
  });

  it("keeps authenticated clients select-only", async () => {
    const sql = await migrationSql();
    expect(sql.match(/grant select on table public\.security_/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(sql).not.toMatch(/grant\s+(insert|update|delete)\s+on\s+table\s+public\.security_/i);
  });

  it("uses composite workspace integrity and append-only history", async () => {
    const sql = await migrationSql();
    expect(sql).toContain("primary key (workspace_id, finding_id)");
    expect(sql).toContain("primary key (workspace_id, evidence_id)");
    expect(sql).toContain("unique (workspace_id, finding_id, scan_job_id)");
    expect(sql).toContain("Finding history rows are append-only");
  });
});
```

- [ ] **Step 2: Run the migration test and confirm RED**

```bash
npm test -- tests/security-findings/migration.test.ts
```

Expected: ENOENT for the new migration.

- [ ] **Step 3: Create the five bounded tables**

The migration must define these core shapes and constraints (retain exact domain value checks):

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
  location jsonb check (location is null or (jsonb_typeof(location) = 'object' and pg_column_size(location) <= 8192)),
  taxonomy jsonb not null check (jsonb_typeof(taxonomy) = 'object' and pg_column_size(taxonomy) <= 16384),
  remediation jsonb check (remediation is null or (jsonb_typeof(remediation) = 'object' and pg_column_size(remediation) <= 16384)),
  lifecycle_state text not null check (lifecycle_state in ('open','acknowledged','in_progress','resolved','retest_pending','verified_fixed','accepted_risk','false_positive')),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_seen_job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, finding_id),
  check (first_seen_at <= last_seen_at),
  foreign key (asset_id, workspace_id) references public.assets(id, workspace_id) on delete cascade,
  foreign key (last_seen_job_id, workspace_id, asset_id) references public.scan_jobs(id, workspace_id, asset_id)
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

Add association, occurrence, and event tables with composite FKs, bounded reason/metadata, and:

```sql
unique (workspace_id, finding_id, scan_job_id)
```

on occurrences. Add a partial unique index for system observation-derived events with non-null `scan_job_id`:

```sql
create unique index security_finding_events_scan_event_unique
  on public.security_finding_events(workspace_id, finding_id, scan_job_id, event_type)
  where scan_job_id is not null and actor_type = 'system';
```

- [ ] **Step 4: Add append-only and immutable guards**

Create trigger functions that reject UPDATE/DELETE on evidence, occurrence, and event rows with the stable message:

```sql
raise exception 'Finding history rows are append-only';
```

Allow `security_findings` updates only for materialized current state; reject changes to `workspace_id`, `finding_id`, `asset_id`, `source_kind`, or `source_id` after insert.

- [ ] **Step 5: Add RLS, grants, and indexes**

For all five tables:

```sql
alter table public.<table> enable row level security;
create policy <table>_select_member on public.<table>
for select to authenticated using (private.is_workspace_member(workspace_id));
revoke all on table public.<table> from anon, authenticated;
grant select on table public.<table> to authenticated;
```

Add leading-column indexes for every composite FK and list/detail queries:

```sql
create index security_findings_workspace_lifecycle_seen_idx
  on public.security_findings(workspace_id, lifecycle_state, last_seen_at desc);
create index security_findings_workspace_asset_seen_idx
  on public.security_findings(workspace_id, asset_id, last_seen_at desc);
create index security_finding_occurrences_job_idx
  on public.security_finding_occurrences(scan_job_id, workspace_id, asset_id);
```

- [ ] **Step 6: Update `lib/database.types.ts`**

Add exact string unions:

```ts
export type FindingLifecycleState = "open" | "acknowledged" | "in_progress" | "resolved" | "retest_pending" | "verified_fixed" | "accepted_risk" | "false_positive";
export type SecuritySeverity = "critical" | "high" | "medium" | "low" | "info";
export type SecurityConfidence = "high" | "medium" | "low";
export type SecurityValidationState = "unvalidated" | "static_confirmed" | "runtime_observed" | "runtime_validated" | "user_confirmed";
```

Add Row/Insert/Update table typings matching the SQL. Keep history-table `Update` types structurally present for Supabase typing even though database triggers reject mutation.

- [ ] **Step 7: Run migration test and typecheck; commit**

```bash
npm test -- tests/security-findings/migration.test.ts
npm run typecheck
git add supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql lib/database.types.ts tests/security-findings/migration.test.ts
git commit -m "feat: add hosted security finding ledger"
```

---

### Task 3: Add pure trusted ingestion normalization

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

- [ ] **Step 1: Write RED tests for trusted runtime input**

Cover:

```ts
it("accepts a canonical runtime finding with referenced evidence", () => { /* expect prepared JSON */ });
it("rejects a finding for another asset", () => { /* assetRef mismatch */ });
it("rejects missing evidence references", () => { /* finding references unknown id */ });
it("rejects conflicting duplicate evidence ids", () => { /* same id, different summary */ });
it("rejects advisory-inference and secret evidence in Phase 5A runtime ingestion", () => { /* source/classification */ });
it("bounds ids, descriptions, taxonomy, remediation, and evidence summary", () => { /* oversize fails */ });
```

Use `assetRef(input.assetId)` as the exact expected asset-ref representation.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- tests/security-findings/ingestion.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement strict source-authority validation**

In `ingestion.ts`, accept only Phase 5A hosted runtime combinations:

```ts
function assertRuntimeAuthority(finding: SecurityFinding): void {
  if (finding.source.kind !== "deterministic-runtime-scanner") {
    throw new Error("Phase 5A hosted ingestion accepts deterministic runtime findings only.");
  }
  if (finding.provenance.kind !== "scanner-derived") {
    throw new Error("Runtime finding provenance must be scanner-derived.");
  }
  if (finding.validation !== "runtime_observed" && finding.validation !== "runtime_validated") {
    throw new Error("Runtime finding validation state is incompatible with hosted ingestion.");
  }
}
```

Evidence accepted from runtime must be `public`, provenance `observed`, and kinds `http-observation` or `tls-observation`; current CORS evidence uses `http-observation`.

- [ ] **Step 4: Serialize only bounded canonical fields**

Map findings to snake_case JSON objects consumed by SQL:

```ts
{
  finding_id: String(finding.id),
  source_kind: finding.source.kind,
  source_id: finding.source.sourceId,
  source_version: finding.source.sourceVersion ?? null,
  scan_run_ref: finding.source.scanRunRef ? String(finding.source.scanRunRef) : null,
  rule_ref: String(finding.rule),
  title: finding.title,
  description: finding.description,
  severity: finding.severity,
  confidence: finding.confidence,
  validation_state: finding.validation,
  provenance_kind: finding.provenance.kind,
  location: finding.location ?? null,
  taxonomy: finding.taxonomy,
  remediation: finding.remediation ?? null,
  evidence_refs: finding.evidenceRefs.map(String),
}
```

Do not serialize lifecycle from scanner input as mutation authority; SQL/service creates new rows as `open` and preserves existing workflow state.

- [ ] **Step 5: Run focused tests; commit**

```bash
npm test -- tests/security-findings/ingestion.test.ts
git add lib/security-findings/types.ts lib/security-findings/ingestion.ts tests/security-findings/ingestion.test.ts
git commit -m "feat: validate hosted finding ingestion"
```

---

### Task 4: Add transactional ledger ingestion and narrow runtime result RPCs

**Files:**
- Modify: `supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql`
- Modify: `lib/database.types.ts`
- Create: `tests/security-findings/result-transaction.test.ts`

**Interfaces:**
- Internal SQL helper: `private.ingest_security_finding_batch(...)`.
- Service-role RPCs:
  - `public.persist_passive_runtime_result(target_workspace_id uuid, target_asset_id uuid, target_job_id uuid, observation_rows jsonb, finding_rows jsonb, evidence_rows jsonb, observed_at timestamptz)`
  - `public.persist_active_validation_result(target_workspace_id uuid, target_asset_id uuid, target_job_id uuid, observation_row jsonb, finding_rows jsonb, evidence_rows jsonb, observed_at timestamptz)`

- [ ] **Step 1: Write SQL-boundary regressions**

Assert both RPCs:

```ts
expect(sql).toMatch(/create or replace function public\.persist_passive_runtime_result/i);
expect(sql).toMatch(/create or replace function public\.persist_active_validation_result/i);
expect(sql).toMatch(/from public\.scan_jobs[\s\S]*for update/i);
expect(sql).toContain("Runtime result persistence requires a running uncancelled job");
expect(sql).toContain("private.ingest_security_finding_batch");
expect(sql).toContain("grant execute on function public.persist_passive_runtime_result");
expect(sql).toContain("to service_role");
expect(sql).not.toMatch(/grant execute[\s\S]*persist_(passive_runtime|active_validation)_result[\s\S]*to authenticated/i);
```

Also assert occurrence/event retry deduplication and identity conflict handling are present.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- tests/security-findings/result-transaction.test.ts
```

- [ ] **Step 3: Implement the internal ingestion helper**

The helper must, inside the caller transaction:

1. Validate each finding/evidence JSON object is an object and bounded by table checks.
2. Insert evidence with `ON CONFLICT DO NOTHING`, then compare existing immutable content and raise `EVIDENCE_ID_CONFLICT` on mismatch.
3. Insert new findings with lifecycle `open`, or lock existing rows and reject workspace/asset/source/rule-family identity drift.
4. Preserve existing lifecycle unless deterministic recurrence applies.
5. Insert finding/evidence links idempotently.
6. Insert occurrence `ON CONFLICT DO NOTHING`.
7. Emit `finding.created` / `finding.reobserved` / `finding.reopened` only when the occurrence was newly inserted.
8. Update `last_seen_at` / `last_seen_job_id` only when `observed_at >= last_seen_at` so an older retry cannot move time backwards.

Recurrence SQL must implement:

```text
resolved      -> in_progress
retest_pending -> in_progress
verified_fixed -> open
accepted_risk -> unchanged
false_positive -> unchanged
```

- [ ] **Step 4: Implement each narrow result RPC**

Both RPCs must:

```sql
select job_kind::text, status::text, cancel_requested_at
into job_kind_text, job_status, job_cancel_requested_at
from public.scan_jobs
where id = target_job_id
  and workspace_id = target_workspace_id
  and asset_id = target_asset_id
for update;

if job_status <> 'running' or job_cancel_requested_at is not null then
  raise exception 'Runtime result persistence requires a running uncancelled job';
end if;
```

Then validate exact job kind, insert the bounded runtime observation rows, and call `private.ingest_security_finding_batch` before returning. One PostgreSQL function call is the atomic transaction boundary.

Use `security definer set search_path = ''`, revoke from `public, anon, authenticated`, and grant only to `service_role`.

- [ ] **Step 5: Add Supabase function types**

Populate `Database["public"]["Functions"]` with exact argument types and `Returns: undefined` (or the actual `void` mapping used by Supabase typings).

- [ ] **Step 6: Run focused tests/typecheck; commit**

```bash
npm test -- tests/security-findings/migration.test.ts tests/security-findings/result-transaction.test.ts
npm run typecheck
git add supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql lib/database.types.ts tests/security-findings/result-transaction.test.ts
git commit -m "feat: add atomic runtime finding persistence"
```

---

### Task 5: Integrate active validation with canonical persistence

**Files:**
- Modify: `lib/active-validation/repository.ts`
- Modify: `lib/active-validation/service.ts`
- Modify: `tests/runtime-validator/repository.test.ts`
- Modify: `tests/runtime-validator/service.test.ts`
- Add: `tests/security-findings/active-integration.test.ts`

**Interfaces:**
- Replace repository `persistObservation(...)` with:

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

- [ ] **Step 1: Write RED repository/service tests**

Require `persistResult` to call only `persist_active_validation_result` and never insert ledger tables directly. Service test must assert findings/evidence passed to persistence before success transition.

Add cancellation regression: cancellation requested before `persistResult` yields no successful result persistence; if `persistResult` commits, late active cancellation remains rejected by the existing DB boundary.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- tests/runtime-validator/repository.test.ts tests/runtime-validator/service.test.ts tests/security-findings/active-integration.test.ts
```

- [ ] **Step 3: Implement active repository call**

Use existing observation normalizer plus `prepareFindingIngestionBatch`:

```ts
const prepared = prepareFindingIngestionBatch({
  workspaceId: job.workspace_id,
  assetId: job.asset_id,
  scanJobId: job.id,
  observedAt,
  findings,
  evidence,
});

const { error } = await admin.rpc("persist_active_validation_result", {
  target_workspace_id: job.workspace_id,
  target_asset_id: job.asset_id,
  target_job_id: job.id,
  observation_row: toJson(row),
  finding_rows: prepared.findings,
  evidence_rows: prepared.evidence,
  observed_at: prepared.observedAt,
});
```

- [ ] **Step 4: Integrate service without changing network authority**

After rules/mapping and the final cancellation snapshot, call:

```ts
await repository.persistResult(
  runningJob,
  validationResult.observation,
  findings,
  evidence,
  authorization.budget.maxObservationBytes,
  clock(dependencies)(),
);
```

Keep existing success transition and active cancellation semantics. Do not retry network execution if persistence succeeded but `markSucceeded` conflicts.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- tests/runtime-validator tests/security-findings/active-integration.test.ts
git add lib/active-validation/repository.ts lib/active-validation/service.ts tests/runtime-validator tests/security-findings/active-integration.test.ts
git commit -m "feat: persist active runtime findings"
```

---

### Task 6: Integrate passive runtime observations with canonical persistence

**Files:**
- Modify: `lib/runtime-observations/repository.ts`
- Modify: `lib/runtime-observations/service.ts`
- Modify: `tests/runtime-observations/repository.test.ts`
- Modify: `tests/runtime-observations/service.test.ts`
- Add: `tests/security-findings/passive-integration.test.ts`

**Interfaces:**

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

- [ ] **Step 1: Write RED integration tests**

Require passive repository to call `persist_passive_runtime_result` exactly once with normalized observation rows plus prepared findings/evidence. Assert service passes deterministic mapped findings/evidence into the same call and only calls `markSucceeded` after it resolves.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- tests/runtime-observations/repository.test.ts tests/runtime-observations/service.test.ts tests/security-findings/passive-integration.test.ts
```

- [ ] **Step 3: Implement passive repository RPC**

Prepare observations with `normalizeRuntimeObservationPayloads`, prepare ledger payload using `prepareFindingIngestionBatch`, then:

```ts
await admin.rpc("persist_passive_runtime_result", {
  target_workspace_id: job.workspace_id,
  target_asset_id: job.asset_id,
  target_job_id: job.id,
  observation_rows: toJson(rows),
  finding_rows: prepared.findings,
  evidence_rows: prepared.evidence,
  observed_at: prepared.observedAt,
});
```

- [ ] **Step 4: Strengthen passive cancellation ordering**

Before persistence, reload the job and cancel if requested. The SQL RPC still owns the atomic final lock/check, preventing a race between this application check and commit.

If persistence fails due cancellation, map the latest cancellation state to `cancelled`; otherwise use stable `RUNTIME_EXECUTION_ERROR` without persisting partial ledger state.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- tests/runtime-observations tests/security-findings/passive-integration.test.ts
git add lib/runtime-observations/repository.ts lib/runtime-observations/service.ts tests/runtime-observations tests/security-findings/passive-integration.test.ts
git commit -m "feat: persist passive runtime findings"
```

---

### Task 7: Add trusted lifecycle service, events, and authorization

**Files:**
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

export async function changeFindingLifecycle(
  input: ChangeFindingLifecycleInput,
  dependencies: SecurityFindingServiceDependencies,
): Promise<SecurityFindingRow>;
```

- [ ] **Step 1: Write authorization/lifecycle RED tests**

Cover exact action map:

```ts
const TARGET_BY_ACTION = {
  acknowledge: "acknowledged",
  start_work: "in_progress",
  resolve: "resolved",
  reopen: "in_progress",
} as const;
```

Tests must prove:

- viewer rejected.
- member/admin/owner allowed only for supported transitions.
- resolve requires non-empty note after trim, maximum 1000 chars.
- reopen requires non-empty reason, maximum 1000 chars.
- accepted-risk/false-positive/retest/verified-fixed cannot be requested through the action type or server boundary.
- lifecycle event captures actor and from/to states.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- tests/security-findings/repository.test.ts tests/security-findings/service.test.ts tests/security-findings/action-boundary.test.ts
```

- [ ] **Step 3: Implement repository compare-and-swap transition**

Load by `(workspace_id, finding_id)`, validate current state, then update with both expected current lifecycle and workspace:

```ts
.update({ lifecycle_state: next, updated_at: now })
.eq("workspace_id", workspaceId)
.eq("finding_id", findingId)
.eq("lifecycle_state", current)
.select("*")
.maybeSingle();
```

Insert `security_finding_events` through the admin client only after a successful transition. Prefer a narrow database RPC if needed to make current-row update + event insert atomic; if so add `public.change_security_finding_lifecycle(...)` granted only to `service_role` and test it like the result RPCs.

- [ ] **Step 4: Implement service authorization**

```ts
function assertContributor(role: WorkspaceRole | null): void {
  if (role !== "owner" && role !== "admin" && role !== "member") {
    throw new SecurityFindingAuthorizationError("FINDING_WORKFLOW_DENIED");
  }
}
```

Use `canTransitionFindingLifecycle(current, next)` plus an explicit Phase 5A action allowlist. Do not expose generic `toLifecycle` input.

- [ ] **Step 5: Implement dedicated server action**

`changeFindingLifecycleAction(findingId, action, note)` gets `getDashboardContext()`, uses `createAdminClient()` and the service, revalidates `/dashboard/findings` and `/dashboard/findings/${encodeURIComponent(findingId)}`, and returns a bounded `{ ok, data|error }` shape. Browser input contains only finding ID, one of four action values, and bounded note text.

- [ ] **Step 6: Run tests and commit**

```bash
npm test -- tests/security-findings/repository.test.ts tests/security-findings/service.test.ts tests/security-findings/action-boundary.test.ts
npm run typecheck
git add lib/security-findings app/dashboard/findings tests/security-findings supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql lib/database.types.ts
git commit -m "feat: add trusted finding lifecycle workflow"
```

---

### Task 8: Add findings read models, list/detail UI, and navigation

**Files:**
- Extend: `lib/security-findings/repository.ts`
- Create: `app/dashboard/findings/page.tsx`
- Create: `app/dashboard/findings/[findingId]/page.tsx`
- Create: `components/findings/FindingLifecycleControls.tsx`
- Modify: `components/SideNav.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/globals.css`
- Create: `tests/components/FindingLifecycleControls.test.tsx`
- Create: `tests/security-findings/read-model.test.ts`

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

- [ ] **Step 1: Write UI/read-model tests first**

Require:

- list query always filters `workspace_id` and orders `last_seen_at desc`.
- detail loaders scope finding, evidence links, occurrence, and events by workspace and finding ID.
- lifecycle control does not render forbidden Phase 5C actions.
- viewer receives no mutation controls.
- resolution/reopen note field is required for those actions.

- [ ] **Step 2: Confirm RED**

```bash
npm test -- tests/security-findings/read-model.test.ts tests/components/FindingLifecycleControls.test.tsx
```

- [ ] **Step 3: Implement `/dashboard/findings`**

Use `getDashboardContext()` and the authenticated Supabase client for SELECT-only RLS reads. Render title, asset name/reference, severity, confidence, validation, lifecycle, source, first/last seen, and link to detail. No raw JSON dump.

Default sort: newest `last_seen_at` first. Use only bounded database fields.

- [ ] **Step 4: Implement finding detail**

Route param must be decoded and used only in workspace-scoped queries. Render:

- title/description
- severity/confidence/validation/lifecycle
- source/rule identity
- first/last seen
- bounded taxonomy/remediation display
- evidence summaries/classification
- recent occurrence history
- lifecycle event history with bounded reason

Do not render hidden raw response data because no such fields should exist in the ledger.

- [ ] **Step 5: Implement lifecycle controls**

`FindingLifecycleControls` receives current lifecycle and role and derives available actions. It never accepts arbitrary target state. For example:

```ts
const actionsByState = {
  open: ["acknowledge", "start_work"],
  acknowledged: ["start_work"],
  in_progress: ["resolve"],
  resolved: ["reopen"],
} as const;
```

Other lifecycle states display status only in Phase 5A.

- [ ] **Step 6: Enable navigation and dashboard count**

Change SideNav Findings item to:

```ts
{ href: "/dashboard/findings", label: "Findings", Icon: Bug, match: "prefix" as const }
```

On dashboard, query `security_findings` with workspace RLS and count states not equal to `verified_fixed`, `accepted_risk`, or `false_positive` as the current open-work metric. Replace stale Phase 2 scanner-disabled copy with current runtime/findings wording.

- [ ] **Step 7: Add responsive styles and run tests/build**

Add namespaced findings classes; do not regress mobile `appGrid` behavior.

```bash
npm test -- tests/security-findings tests/components/FindingLifecycleControls.test.tsx
npm run typecheck
npm run build
git add app/dashboard components/SideNav.tsx components/findings app/globals.css lib/security-findings tests
git commit -m "feat: add hosted findings workflow UI"
```

---

### Task 9: Add architecture and security regression guards

**Files:**
- Create: `tests/architecture/security-findings-dependencies.test.ts`
- Extend: `tests/security-findings/migration.test.ts`
- Extend: runtime active/passive tests as needed.

**Interfaces:**
- `packages/security-domain` remains independent.
- `lib/security-findings` may import security-domain, database types, Supabase types/adapters, and workspace/audit helpers, but not runtime network/observer/validator packages.
- runtime packages must not import `lib/security-findings` application services.
- runtime application repositories may import only the pure ingestion serializer/types from `lib/security-findings` as approved by the plan, not lifecycle/UI services.

- [ ] **Step 1: Write dependency guard**

Read source trees and reject imports matching:

```ts
const forbiddenInSecurityDomain = ["@/lib/", "@supabase/", "next/", "react"];
const forbiddenInFindingService = [
  "@/packages/runtime-network",
  "@/packages/runtime-observer",
  "@/packages/runtime-validator",
];
```

For runtime package folders (`packages/runtime-observer`, `packages/runtime-validator`, `packages/runtime-network`) reject any `@/lib/security-findings` import.

- [ ] **Step 2: Add SQL security regressions**

Assert:

- authenticated gets SELECT only.
- result RPCs grant only service_role.
- history rows have append-only triggers.
- workspace/asset/job composite foreign keys exist.
- user lifecycle server action is not a generic database RPC exposed to authenticated clients.
- no table accepts raw response bodies or arbitrary headers fields.

- [ ] **Step 3: Run security-focused suite and commit**

```bash
npm test -- tests/architecture tests/security-findings tests/runtime-observations tests/runtime-validator
npm run typecheck
git add tests/architecture tests/security-findings
git commit -m "test: guard hosted finding boundaries"
```

---

### Task 10: Permanent docs, full verification, security diff review, and merge gate

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PHASES.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`

**Interfaces:**
- Phase 5A docs must distinguish implementation status from Phase 5B Security Stories and Phase 5C remediation/retest.

- [ ] **Step 1: Update permanent architecture**

Document:

```text
runtime deterministic mapping
        -> trusted result transaction
        -> security_findings current materialization
        -> immutable evidence + occurrence/event history
        -> RLS SELECT-only browser views
        -> trusted lifecycle actions
```

State explicitly that Phase 5A adds no new network/scanner authority and that Phase 3 hosted import remains future work.

- [ ] **Step 2: Update roadmap/development state conservatively**

Before merge, write “Phase 5A implemented in PR #<n>, awaiting exact-head gate” rather than “complete”. Record actual test counts only from a completed CI run.

- [ ] **Step 3: Run the exact full local/CI gate**

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Required outcome: every command exits 0 on the exact final PR head.

- [ ] **Step 4: Perform full security diff review**

Review every changed file and explicitly verify:

- no browser write grants to ledger tables
- no generic finding ingestion browser/API endpoint
- no workspace/asset/job cross-tenant path
- no ability for scanner input to overwrite human lifecycle state
- no inference/advisory promotion into deterministic validation
- no disappearance-based closure
- recurrence only follows approved states
- atomic observation + finding/evidence persistence under job lock
- idempotent retry cannot duplicate occurrence/events
- active cancellation semantics remain linearizable
- evidence remains bounded and non-secret
- no network authority widening

Fix any plausible finding test-first before merge.

- [ ] **Step 5: Check reviews and exact-head CI**

Require no unresolved review threads, no blocking submitted review, `mergeable: true`, and the exact unchanged final head fully green.

- [ ] **Step 6: Squash merge with expected-head protection**

Use the exact head SHA in the merge request. If the head moves after verification, discard the older gate and rerun on the new head.

- [ ] **Step 7: Post-merge state synchronization**

After merge, update docs only if the implementation PR intentionally left “awaiting merge” wording. Run that docs-only PR through the same exact-head gate before merging it. Do not claim a post-merge workflow exists unless GitHub exposes one.

---

## Plan Self-Review Checklist

Before execution, verify the plan covers every approved spec requirement:

- durable canonical IDs and passive source-version hardening
- five-table workspace-scoped ledger
- immutable evidence and append-only occurrence/event history
- browser SELECT-only RLS
- trusted deterministic runtime ingestion only
- transactional passive/active result persistence under job lock
- cancellation semantics and idempotent retry
- first/last seen and occurrence history
- human lifecycle preservation plus approved recurrence
- no disappearance-based remediation
- limited member/admin/owner lifecycle actions with viewer read-only
- no risk acceptance/false-positive/retest/verified-fixed UI action
- list/detail UI and navigation
- architecture guards
- docs and exact full merge gate

No `TODO`, `TBD`, “similar to”, generic “add validation”, or unspecified test steps are permitted in the final plan.