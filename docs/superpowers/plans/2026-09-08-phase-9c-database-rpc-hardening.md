# Phase 9C Database and RPC Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unnecessary direct execution authority from 17 private trigger-only PostgreSQL functions, preserve the two authenticated RLS helpers, and make future `postgres`-owned application functions deny broad execution by default.

**Architecture:** Use one forward-only ACL migration and one focused Vitest architecture regression file. No function bodies, triggers, policies, tables, enums, indexes, runtime flags, provider settings, or Dashboard V5 files change. Before permanent DDL, prove the trigger-execution assumption on the exact live Supabase PostgreSQL engine with a rollback-only canary.

**Tech Stack:** PostgreSQL 17.x on Supabase, SQL migrations, Vitest 3.2, Node 22, Next.js 15.5.24, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-08-phase-9c-database-rpc-hardening-design.md`

## Global Constraints

- ScopeForge Supabase project is exactly `tdgpibrepzcvdivztkta`.
- Branch is exactly `feat/phase-9c-database-rpc-hardening-v1` from baseline `c4aaf76a08960d68159d9c96f053e38e7963a859`.
- Never rewrite deployed migrations. Corrections are forward-only.
- Keep `authenticated` `USAGE` on schema `private` because RLS calls `private.is_workspace_member` and `private.has_workspace_role`.
- Do not change `supabase_admin` default privileges.
- Do not change legacy table grants on `profiles`, `workspaces`, or `workspace_members` in Phase 9C v1.
- Do not change function bodies, trigger definitions, RLS policies, table schemas, generated database types, package dependencies, or Dashboard V5/UI PR #49.
- Keep `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`, `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`, `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`, and `HOSTED_ACTIVE_CORS_WORKER_ENABLED` false/absent.
- Do not change leaked-password protection, Turnstile, Auth rate limits, Vercel WAF, or CSP.
- Use `[skip ci]` on intermediate commits. Reserve substantive GitHub Actions for one frozen release candidate.
- Do not claim a gate passed unless evidence is tied to the exact relevant SHA or live database state.

---

### Task 1: Add the failing Phase 9C ACL contract

**Files:**
- Create: `tests/architecture/phase-9c-database-rpc-hardening.test.ts`
- Future dependency: `supabase/migrations/20260908170000_phase_9c_function_acl_hardening.sql`

**Interfaces:**
- Consumes: the approved list of 17 trigger-only private functions and two RLS helpers.
- Produces: a static migration contract that later tasks must satisfy.

- [ ] **Step 1: Create the failing test before the migration exists**

Use this structure:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath = "supabase/migrations/20260908170000_phase_9c_function_acl_hardening.sql";

const triggerOnlyFunctions = [
  "enforce_trial_asset_limit",
  "enforce_verification_quota",
  "guard_asset_verification_fields",
  "guard_runtime_observation_insert",
  "guard_runtime_scan_job_update",
  "guard_security_finding_retest_update",
  "guard_security_finding_update",
  "guard_verification_challenge_update",
  "handle_new_user",
  "handle_workspace_usage_row",
  "recover_security_finding_after_unverified_retest",
  "reject_security_evidence_mutation",
  "reject_security_finding_history_mutation",
  "reject_security_phase3_import_run_mutation",
  "set_updated_at",
  "sync_asset_usage",
  "sync_verification_usage",
] as const;

async function migration(): Promise<string> {
  return readFile(migrationPath, "utf8");
}

describe("Phase 9C database and RPC hardening", () => {
  it("revokes direct execution of every trigger-only private function", async () => {
    const sql = await migration();
    for (const fn of triggerOnlyFunctions) {
      expect(sql).toMatch(new RegExp(
        `revoke\\s+execute\\s+on\\s+function\\s+private\\.${fn}\\(\\)\\s+from\\s+public,\\s*anon,\\s*authenticated,\\s*service_role`,
        "i",
      ));
    }
  });

  it("preserves only the authenticated RLS helper interface", async () => {
    const sql = await migration();
    expect(sql).toMatch(/grant\s+usage\s+on\s+schema\s+private\s+to\s+authenticated/i);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+private\.is_workspace_member\(uuid\)\s+to\s+authenticated/i);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+private\.has_workspace_role\(uuid,\s*public\.workspace_role\[\]\)\s+to\s+authenticated/i);
    expect(sql).toMatch(/revoke\s+all\s+on\s+schema\s+private\s+from\s+public,\s*anon,\s*service_role/i);
  });

  it("makes future postgres-owned public and private functions explicit-grant only", async () => {
    const sql = await migration();
    for (const schema of ["private", "public"]) {
      expect(sql).toMatch(new RegExp(
        `alter\\s+default\\s+privileges\\s+for\\s+role\\s+postgres\\s+in\\s+schema\\s+${schema}\\s+revoke\\s+execute\\s+on\\s+functions\\s+from\\s+public,\\s*anon,\\s*authenticated,\\s*service_role`,
        "i",
      ));
    }
  });

  it("does not widen or mix table, policy, trigger, or worker authority changes", async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/\b(create|alter|drop)\s+table\b/i);
    expect(sql).not.toMatch(/\b(create|alter|drop)\s+policy\b/i);
    expect(sql).not.toMatch(/\b(create|alter|drop)\s+trigger\b/i);
    expect(sql).not.toMatch(/\bgrant\s+(select|insert|update|delete)\b/i);
    expect(sql).not.toMatch(/\bprofiles\b|\bworkspace_members\b|\bworkspaces\b/i);
    expect(sql).not.toMatch(/HOSTED_(REPOSITORY|PASSIVE|ACTIVE)/i);
  });
});
```

- [ ] **Step 2: Verify the RED state**

Run when a local checkout is available:

```bash
npm test -- --run tests/architecture/phase-9c-database-rpc-hardening.test.ts
```

Expected: FAIL because `20260908170000_phase_9c_function_acl_hardening.sql` does not exist.

If this harness still has no executable checkout, structurally prove RED by confirming the test references a nonexistent migration path. Do not claim the test process executed.

- [ ] **Step 3: Commit test only**

```bash
git add tests/architecture/phase-9c-database-rpc-hardening.test.ts
git commit -m "test: define Phase 9C database ACL boundary [skip ci]"
```

---

### Task 2: Add the minimal forward-only ACL migration

**Files:**
- Create: `supabase/migrations/20260908170000_phase_9c_function_acl_hardening.sql`
- Test: `tests/architecture/phase-9c-database-rpc-hardening.test.ts`

**Interfaces:**
- Consumes: the RED migration contract from Task 1.
- Produces: the complete permanent Phase 9C database mutation.

- [ ] **Step 1: Create exactly this migration shape**

```sql
revoke all on schema private from public, anon, service_role;
grant usage on schema private to authenticated;

revoke all on function private.is_workspace_member(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.is_workspace_member(uuid)
  to authenticated;

revoke all on function private.has_workspace_role(uuid, public.workspace_role[])
  from public, anon, authenticated, service_role;
grant execute on function private.has_workspace_role(uuid, public.workspace_role[])
  to authenticated;

revoke execute on function private.enforce_trial_asset_limit() from public, anon, authenticated, service_role;
revoke execute on function private.enforce_verification_quota() from public, anon, authenticated, service_role;
revoke execute on function private.guard_asset_verification_fields() from public, anon, authenticated, service_role;
revoke execute on function private.guard_runtime_observation_insert() from public, anon, authenticated, service_role;
revoke execute on function private.guard_runtime_scan_job_update() from public, anon, authenticated, service_role;
revoke execute on function private.guard_security_finding_retest_update() from public, anon, authenticated, service_role;
revoke execute on function private.guard_security_finding_update() from public, anon, authenticated, service_role;
revoke execute on function private.guard_verification_challenge_update() from public, anon, authenticated, service_role;
revoke execute on function private.handle_new_user() from public, anon, authenticated, service_role;
revoke execute on function private.handle_workspace_usage_row() from public, anon, authenticated, service_role;
revoke execute on function private.recover_security_finding_after_unverified_retest() from public, anon, authenticated, service_role;
revoke execute on function private.reject_security_evidence_mutation() from public, anon, authenticated, service_role;
revoke execute on function private.reject_security_finding_history_mutation() from public, anon, authenticated, service_role;
revoke execute on function private.reject_security_phase3_import_run_mutation() from public, anon, authenticated, service_role;
revoke execute on function private.set_updated_at() from public, anon, authenticated, service_role;
revoke execute on function private.sync_asset_usage() from public, anon, authenticated, service_role;
revoke execute on function private.sync_verification_usage() from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
```

Do not add comments that claim runtime behavior not yet verified. Do not include table grants or managed-role defaults.

- [ ] **Step 2: Verify GREEN for the focused test**

```bash
npm test -- --run tests/architecture/phase-9c-database-rpc-hardening.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the nearest existing worker migration/architecture regression set**

```bash
npm test -- --run tests/workers/migration.test.ts tests/architecture/phase6d-runtime-workers.test.ts tests/architecture/phase-9c-database-rpc-hardening.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit migration only after test-first ordering is preserved**

```bash
git add supabase/migrations/20260908170000_phase_9c_function_acl_hardening.sql
git commit -m "fix: harden private function ACL defaults [skip ci]"
```

---

### Task 3: Reconcile live baseline and prove trigger semantics with a rollback-only canary

**Files:**
- No repository mutation.
- Live project: `tdgpibrepzcvdivztkta`.

**Interfaces:**
- Consumes: reviewed migration text from Task 2.
- Produces: exact live-engine and rollback-canary evidence required before permanent DDL.

- [ ] **Step 1: Re-read engine and privilege baseline**

Run read-only SQL that returns:

```sql
select current_setting('server_version') as server_version;
```

Also re-run the established inventory for:

- schema `private` usage for `PUBLIC`, `anon`, `authenticated`, `service_role`
- private-table CRUD privileges for `anon` and `authenticated`
- execution privileges on the 19 relevant private functions
- execution privileges on public `SECURITY DEFINER` functions for `anon` and `authenticated`
- trigger bindings for the 17 trigger-only functions
- `proconfig`/search-path settings on relevant `SECURITY DEFINER` functions
- `pg_default_acl` for role `postgres` in schemas `private` and `public`

Stop if the live function list, trigger binding set, helper signatures, or engine major version differs materially from the approved spec.

- [ ] **Step 2: Execute this rollback-only trigger canary**

Use raw SQL execution because the transaction must roll back and must not create migration history:

```sql
begin;

create table private.phase9c_acl_canary (
  id integer primary key,
  marker text not null
);

create function private.phase9c_acl_canary_fn()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.marker := 'fired';
  return new;
end;
$$;

create trigger phase9c_acl_canary_trigger
before insert on private.phase9c_acl_canary
for each row execute function private.phase9c_acl_canary_fn();

grant insert, select on private.phase9c_acl_canary to authenticated;
grant execute on function private.phase9c_acl_canary_fn() to authenticated;

revoke execute on function private.phase9c_acl_canary_fn()
  from public, anon, authenticated, service_role;

set local role authenticated;
insert into private.phase9c_acl_canary(id, marker) values (1, 'pending');
reset role;

select id, marker
from private.phase9c_acl_canary
where id = 1;

rollback;
```

Expected row before rollback:

```text
id = 1
marker = fired
```

- [ ] **Step 3: Prove rollback cleanliness**

```sql
select
  to_regclass('private.phase9c_acl_canary') as table_after_rollback,
  to_regprocedure('private.phase9c_acl_canary_fn()') as function_after_rollback;
```

Expected: both `NULL`.

If the insert fails because the revoked trigger function cannot fire, stop. Do not apply the permanent migration.

---

### Task 4: Apply the reviewed migration and run live acceptance

**Files:**
- Repository migration from Task 2 is the source of truth.
- Live project: `tdgpibrepzcvdivztkta`.

**Interfaces:**
- Consumes: successful Task 3 canary and exact reviewed SQL.
- Produces: hardened production ACL state and migration-history record.

- [ ] **Step 1: Apply through the Supabase migration operation**

Migration name:

```text
phase_9c_function_acl_hardening
```

Migration body must be byte-for-byte semantically equivalent to `supabase/migrations/20260908170000_phase_9c_function_acl_hardening.sql`. Do not add unrelated SQL while applying.

- [ ] **Step 2: Prove private table access remains closed**

For every private worker table, assert `has_table_privilege('anon', ..., 'SELECT,INSERT,UPDATE,DELETE')` and the equivalent `authenticated` checks are false for every individual privilege.

- [ ] **Step 3: Prove private function authority is exact**

Expected for `authenticated`:

```text
is_workspace_member = executable
has_workspace_role = executable
17 trigger-only functions = not executable
all other private worker/internal routines = not executable
```

Expected for `anon`: no private application function executable through intended browser authority.

- [ ] **Step 4: Prove public worker RPC authority remains closed**

Query public `SECURITY DEFINER` functions and require zero functions where either `anon` or `authenticated` has execute privilege.

- [ ] **Step 5: Prove trigger and search-path integrity**

Require all pre-migration trigger bindings for the 17 functions still exist and are enabled. Require every relevant `SECURITY DEFINER` application function still has `search_path=""` in `proconfig`.

- [ ] **Step 6: Prove future-function defaults are hardened**

Inspect `pg_default_acl` and require role `postgres`, schema `private` and schema `public` to give none of `PUBLIC`, `anon`, `authenticated`, or `service_role` automatic function execution.

- [ ] **Step 7: Run Supabase Security Advisor**

Expected Phase 9C result: no new database-security warning caused by the migration. If `auth_leaked_password_protection` remains, record it as a separate pending Phase 9 provider control rather than a Phase 9C failure.

---

### Task 5: Add the resumable Phase 9C working checkpoint and preflight the candidate

**Files:**
- Modify: `docs/development/PHASE_9_WORKING_STATE.md`
- Modify: `docs/development/SESSION_HANDOFF.md`

**Interfaces:**
- Consumes: exact migration version, live acceptance results, advisor result.
- Produces: a resumable branch state without declaring release complete.

- [ ] **Step 1: Record exact live evidence**

Document:

- current branch head
- migration repository path
- actual Supabase migration history version returned by the platform
- PostgreSQL version used for the canary
- canary success and rollback-clean proof
- live ACL acceptance summary
- advisor state
- explicit statement that legacy table grants, Auth controls, WAF, CSP, runtime flags, and Dashboard V5 were untouched

- [ ] **Step 2: Commit the working checkpoint**

```bash
git add docs/development/PHASE_9_WORKING_STATE.md docs/development/SESSION_HANDOFF.md
git commit -m "docs: checkpoint Phase 9C database hardening [skip ci]"
```

- [ ] **Step 3: Scope review**

Compare branch to `c4aaf76a08960d68159d9c96f053e38e7963a859` and require only:

- Phase 9C spec/plan docs
- one Phase 9C architecture test
- one Phase 9C ACL migration
- Phase 9C working/handoff docs

Explicitly reject changes to `package.json`, lockfiles, `app/layout.tsx`, Dashboard V5 paths, worker runtime source, Supabase Auth config, or unrelated migrations.

- [ ] **Step 4: Verify exact-head Vercel Preview READY**

The Preview is a build/type integration gate only. The database acceptance evidence remains the authoritative ACL gate.

---

### Task 6: Freeze, validate, merge, and verify Phase 9C release

**Files:**
- No code changes after freeze except a tree-identical freeze commit if needed by the established release process.
- Post-release docs checkpoint created only after independent `main` verification.

**Interfaces:**
- Consumes: stable reviewed branch tree and live Supabase acceptance.
- Produces: merged Phase 9C release with exact CI/deployment evidence.

- [ ] **Step 1: Freeze one exact candidate**

Confirm branch is zero behind `main` and record candidate SHA and tree. Do not amend code after this point.

- [ ] **Step 2: Open PR as draft first**

Keep draft while verifying the exact-head Vercel preview and PR metadata so no substantive CI is spent prematurely.

- [ ] **Step 3: Mark ready and run the one substantive CI candidate**

The repository CI contract is:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm audit --audit-level=info
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run benchmark:matrix
npm run build
```

Every step must pass on the exact frozen candidate SHA.

- [ ] **Step 4: Run immutable pre-merge review**

Require:

- exact PR head still equals frozen candidate
- base still equals current intended `main`
- mergeable state is clean
- all reviews/threads are resolved or absent
- combined status is success
- Vercel preview is READY with no alias error
- diff scope remains Phase 9C-only
- live Supabase acceptance still reflects the applied migration

- [ ] **Step 5: Squash-merge with expected head protection**

Merge only if the API can reject a head race or the head has just been re-read and is unchanged. Record squash SHA and tree.

- [ ] **Step 6: Independently verify `main`**

Require post-merge main CI success and an exact production Vercel deployment for the squash SHA that is READY and serves `scopeforge.dev` with `aliasError=null`.

- [ ] **Step 7: Write one docs-only release checkpoint**

Create/update the standard development state files and a dedicated `docs/development/PHASE_9C_RELEASE_STATE.md`. Record the exact live Supabase migration version, release SHA/tree, PR/final candidate, CI runs, Vercel deployment, advisor state, and next Phase 9 boundary. Commit with `[skip ci]`, verify no redundant Actions run, then verify the normal docs-only production deployment.
