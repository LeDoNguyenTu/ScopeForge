# ScopeForge Phase 9C Database and RPC Defense-in-Depth Design

Date: 2026-09-08

Status: Approved design, implementation not started

Branch: `feat/phase-9c-database-rpc-hardening-v1`

Baseline: `c4aaf76a08960d68159d9c96f053e38e7963a859`

ScopeForge Supabase project: `tdgpibrepzcvdivztkta`

Live PostgreSQL engine at design time: `17.6`

## Purpose

Phase 9C reduces unnecessary PostgreSQL function execution authority without disturbing the released RLS model, worker-control RPC boundary, authentication behavior, or Dashboard V5/UI stream.

The live database inventory shows that the current authorization model is mostly sound:

- `anon` and `authenticated` have no direct read access to private worker tables.
- `anon` and `authenticated` cannot execute public worker-control RPCs.
- `authenticated` intentionally has `USAGE` on schema `private` because public RLS policies call two private membership helpers.
- `private.is_workspace_member(uuid)` and `private.has_workspace_role(uuid, public.workspace_role[])` are explicitly executable by `authenticated` and are required by public RLS policies.
- private worker/internal functions already use explicit owner-only ACLs.
- public worker-control RPCs are explicitly service-role-only.
- application-owned privileged functions use a pinned empty `search_path`.

The confirmed defense-in-depth gap is that 17 private trigger-only functions still inherit default PostgreSQL `PUBLIC EXECUTE` privileges. Several are `SECURITY DEFINER`. They do not need direct invocation by browser roles because their intended interface is through already-created triggers.

Phase 9C closes that gap and changes application function defaults so future migrations do not silently recreate it.

## Threat model

### Assets to protect

- workspace membership and role boundaries
- private worker state and worker credentials
- scan-job authorization state
- finding, evidence, and audit integrity
- account bootstrap behavior
- trial and verification quota enforcement
- worker-control RPC authority

### Relevant principals

- `PUBLIC`
- `anon`
- `authenticated`
- `service_role`
- database owner `postgres`
- Supabase-managed platform roles

### Threats addressed

1. A browser-accessible database role directly invokes a private trigger function that was intended to run only through a trigger.
2. A future migration creates a new function and accidentally exposes it because default function privileges grant execution broadly.
3. A hardening change removes `private` schema usage globally and breaks public RLS evaluation.
4. A hardening change accidentally broadens service-role or worker authority while correcting browser-role privileges.
5. A migration rewrites already deployed schema history instead of applying a forward-only correction.

### Threats intentionally deferred

- leaked-password protection
- Turnstile
- Supabase Auth rate-limit changes
- Vercel WAF and application traffic rate limits
- CSP
- production telemetry and alerting
- incident response and release-hardening procedures
- legacy table-grant cleanup on `profiles`, `workspaces`, and `workspace_members`
- worker/runtime production enablement

## Live privilege evidence

### Engine

At design time, the ScopeForge Supabase project reports PostgreSQL `17.6` on 64-bit Linux. Phase 9C must re-read the engine version immediately before the trigger-ACL canary and permanent migration. A managed-engine upgrade between design and execution is treated as drift that requires revalidation, not an assumption that prior behavior still applies.

### Schema boundary

Current `private` schema behavior:

- `PUBLIC`: no usage
- `anon`: no usage
- `authenticated`: usage granted
- `service_role`: no direct schema usage grant

`authenticated` schema usage is intentional and must remain because public RLS policies reference private membership helpers.

### RLS helper dependencies

Public policies depend on:

- `private.is_workspace_member(uuid)`
- `private.has_workspace_role(uuid, public.workspace_role[])`

`private.is_workspace_member` currently supports membership-scoped SELECT policies across workspaces, members, assets, audit events, scan jobs, runtime observations, finding tables, repository snapshots, and repository scan runs.

`private.has_workspace_role` currently supports owner/admin write policies for workspaces and workspace membership.

Both helpers are `SECURITY DEFINER`, use `SET search_path = ''`, and intentionally grant `EXECUTE` to `authenticated` only.

### Worker boundary

Live acceptance queries prove:

- no `anon` private-table reads
- no `authenticated` private-table reads
- no `anon` execution of public worker-control RPCs
- no `authenticated` execution of public worker-control RPCs

This boundary must remain unchanged.

## Trigger-only private functions to harden

The following 17 private functions have trigger bindings and no RLS-policy callers. They currently inherit broad function execution and do not need direct execution by browser roles:

1. `private.enforce_trial_asset_limit()`
2. `private.enforce_verification_quota()`
3. `private.guard_asset_verification_fields()`
4. `private.guard_runtime_observation_insert()`
5. `private.guard_runtime_scan_job_update()`
6. `private.guard_security_finding_retest_update()`
7. `private.guard_security_finding_update()`
8. `private.guard_verification_challenge_update()`
9. `private.handle_new_user()`
10. `private.handle_workspace_usage_row()`
11. `private.recover_security_finding_after_unverified_retest()`
12. `private.reject_security_evidence_mutation()`
13. `private.reject_security_finding_history_mutation()`
14. `private.reject_security_phase3_import_run_mutation()`
15. `private.set_updated_at()`
16. `private.sync_asset_usage()`
17. `private.sync_verification_usage()`

Several of these functions are `SECURITY DEFINER`, including account bootstrap, usage synchronization, and quota-enforcement routines. Direct browser execution is therefore unnecessary authority even though schema lookup currently blocks `anon` and trigger semantics limit useful invocation.

## Chosen architecture

Phase 9C uses a narrow privilege-reduction migration rather than restructuring RLS or moving helper functions.

### 1. Preserve the working RLS interface

The migration must preserve:

```sql
grant usage on schema private to authenticated;

grant execute on function private.is_workspace_member(uuid)
  to authenticated;

grant execute on function private.has_workspace_role(uuid, public.workspace_role[])
  to authenticated;
```

It must also keep `PUBLIC`, `anon`, and `service_role` from gaining broader private-schema lookup authority.

### 2. Revoke direct invocation of trigger-only routines

For each of the 17 trigger-only functions, revoke execution from:

- `PUBLIC`
- `anon`
- `authenticated`
- `service_role`

The functions remain owned by `postgres`, and their trigger bindings remain intact. Current PostgreSQL behavior checks trigger-function `EXECUTE` authority when creating or replacing the trigger rather than requiring the DML caller to hold direct function execution authority on each firing. Phase 9C must nevertheless prove this behavior against the exact live Supabase PostgreSQL engine before any permanent ACL change.

The migration changes ACLs only. It does not replace function bodies or triggers.

### 3. Deny broad execution by default for future application functions

For objects subsequently created by role `postgres` in application schemas, Phase 9C changes default function privileges so new functions do not silently inherit broad execution.

Apply explicit default-privilege revocation for both:

- schema `private`
- schema `public`

The intended invariant is:

- a new function created by `postgres` is not automatically executable by `PUBLIC`, `anon`, `authenticated`, or `service_role`
- any intentionally callable RPC must receive an explicit grant in the same forward migration that creates it

This makes the existing worker RPC pattern the required pattern for future privileged functions.

### 4. Do not alter Supabase-managed role defaults in this slice

Phase 9C changes application-owner defaults for `postgres` only.

It does not alter `supabase_admin` default privileges. That role belongs to the managed platform boundary and changing its defaults would widen operational scope without evidence that ScopeForge-created functions depend on it.

### 5. Keep table-grant cleanup separate

Live inventory shows legacy `anon` CRUD grants remain on:

- `public.profiles`
- `public.workspaces`
- `public.workspace_members`

Their current policies are authenticated-only, and repository code accesses these tables after user resolution. However, table-grant cleanup is a separate authorization surface from function ACL hardening.

Phase 9C v1 must not revoke these table grants. A later database-hardening slice may remove them only after dedicated sign-up, bootstrap, workspace, and RLS tests prove the change safe.

## Migration strategy

### Forward-only correction

Do not modify any deployed migration.

Create one new migration after the current migration set. It must contain only:

- exact function `REVOKE` statements for the 17 trigger-only functions
- explicit preservation/reassertion of the two authenticated RLS helper grants
- schema-usage preservation for `authenticated`
- application-owner default-function privilege hardening in `private` and `public`

No table DDL, function body replacement, trigger recreation, policy rewrite, enum change, index change, or data mutation belongs in this migration.

### Idempotence expectations

The migration should use privilege statements that are safe when the current expected ACL state exists. It does not need to support arbitrary historical schemas. The release gate will compare the live baseline before applying the migration.

## Test strategy

Phase 9C follows test-first ordering.

### Static migration regression test

Before the migration is added, create a focused test that requires:

1. all 17 trigger-only functions lose browser/service direct execution
2. both RLS helpers remain explicitly executable by `authenticated`
3. `authenticated` retains `USAGE` on `private`
4. no broad grant is added to private worker tables
5. no `anon` or `authenticated` grant is added to public worker-control RPCs
6. default function privileges are hardened for `postgres` in both `private` and `public`
7. no table grants are modified in the Phase 9C v1 migration

The initial test commit must precede the migration commit.

### Trigger-ACL engine canary

Before applying permanent privilege DDL, run one transaction-scoped canary on the live ScopeForge PostgreSQL engine:

1. re-read `server_version`
2. begin one transaction
3. create a uniquely named disposable canary table and trigger function owned by the migration role
4. create a trigger while the owner has the required trigger-function execution authority
5. revoke direct execution of the canary trigger function from a role used to perform the canary DML
6. execute bounded canary DML and prove the existing trigger still fires
7. roll back the entire transaction
8. query system catalogs and prove no canary object remains

The canary must not touch ScopeForge application tables or user data. If the trigger fails after revocation, stop Phase 9C and redesign the ACL approach before any permanent migration.

### Architecture regression coverage

Add or extend a security architecture test that rejects future Phase 9C regressions such as:

- `GRANT EXECUTE` of any listed trigger-only function to browser roles
- removal of authenticated RLS-helper execution
- revoking authenticated `USAGE` on `private` without a replacement RLS design
- adding direct private worker-table access to browser roles
- widening worker RPC execution to browser roles

### Existing suite

The frozen candidate must still pass the entire existing project test suite, typecheck, CLI build/version, historical benchmark, Phase 8B matrix, npm audit, and production Next.js build.

## Live Supabase acceptance

Database mutation is not considered complete until the live ScopeForge project is queried after the forward migration.

Required post-migration evidence:

### Private table access

For `anon` and `authenticated`:

- zero SELECT privilege on private worker tables
- zero INSERT privilege
- zero UPDATE privilege
- zero DELETE privilege

### Private function execution

For `authenticated`:

- `private.is_workspace_member(uuid)` is executable
- `private.has_workspace_role(uuid, public.workspace_role[])` is executable
- none of the 17 trigger-only functions are directly executable
- internal worker/private routines remain non-executable

For `anon`:

- no private application function is directly executable through intended browser authority

### Public worker RPC execution

For both `anon` and `authenticated`:

- zero execution privilege on public `SECURITY DEFINER` worker-control RPCs

### Trigger integrity

All trigger bindings that currently use the 17 hardened routines must still exist and remain enabled after the ACL migration.

### Search-path integrity

All relevant `SECURITY DEFINER` application functions must retain pinned function configuration with an empty search path.

### Default-privilege integrity

Query `pg_default_acl` after migration and prove future functions created by `postgres` in `private` and `public` do not receive execution automatically for:

- `PUBLIC`
- `anon`
- `authenticated`
- `service_role`

### Advisors

Run Supabase security advisors after the migration.

The existing `auth_leaked_password_protection` warning is outside Phase 9C and must remain reported honestly if still present.

## Release procedure

1. Start from released baseline `c4aaf76a08960d68159d9c96f053e38e7963a859`.
2. Keep Phase 9C on isolated branch `feat/phase-9c-database-rpc-hardening-v1`.
3. Commit test-first regression coverage with `[skip ci]`.
4. Add the forward-only migration with `[skip ci]`.
5. Perform static scope review before any live mutation.
6. Re-query the live privilege baseline and PostgreSQL engine version immediately before any DDL to detect drift.
7. Execute the transaction-scoped trigger-ACL engine canary and prove rollback cleanliness.
8. Apply the reviewed forward migration to ScopeForge project `tdgpibrepzcvdivztkta` only.
9. Execute all live privilege acceptance queries.
10. Run Supabase security advisors.
11. Verify no Dashboard V5/UI path, package dependency, worker-runtime flag, or unrelated provider setting changed.
12. Verify exact-head Vercel Preview READY.
13. Freeze one exact candidate.
14. Run one substantive GitHub Actions validation against the frozen candidate.
15. Recheck base/head, review threads, diff scope, and combined statuses.
16. Squash-merge only the exact verified head.
17. Verify independent post-merge main CI.
18. Verify the exact production Vercel deployment.
19. Write one docs-only `[skip ci]` release/handoff checkpoint.

## Rollback

Privilege reduction is reversible with a new forward-only migration. Do not rewrite or delete the Phase 9C migration after deployment.

If post-migration acceptance reveals a legitimate direct caller of a hardened function:

1. stop release integration
2. identify the exact role and function required
3. determine whether direct invocation is actually part of the intended interface
4. add the narrowest explicit grant in a new forward migration
5. rerun database acceptance and the full release gates

Do not restore blanket `PUBLIC EXECUTE` as a rollback shortcut.

## Authority boundaries

Phase 9C must not change or enable:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`
- Supabase leaked-password protection
- Turnstile
- Supabase Auth rate limits
- Vercel WAF
- CSP
- Dashboard V5/UI PR #49 or its branches

Phase 9C does not authorize production worker execution and does not change the semantics of any worker RPC.

## Success criteria

Phase 9C v1 is complete only when all of the following are true:

- the 17 trigger-only private functions cannot be directly executed by browser roles or `service_role`
- both authenticated RLS helpers remain usable
- all public RLS behavior remains intact
- private worker tables remain inaccessible to browser roles
- public worker-control RPCs remain inaccessible to browser roles
- trigger bindings remain enabled and the engine canary proves they remain operational after direct-execution revocation
- privileged function search paths remain pinned
- future `postgres`-owned functions in `private` and `public` require explicit execution grants
- no deployed migration was rewritten
- no unrelated table-grant cleanup was bundled
- no provider/UI/runtime authority was widened
- Supabase acceptance evidence, frozen PR CI, main CI, and production deployment evidence are all recorded against exact Git identities
