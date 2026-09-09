# ScopeForge Phase 9C Default ACL Design Amendment

Date: 2026-09-08

Status: Approved corrective amendment during Phase 9C execution

Branch: `feat/phase-9c-database-rpc-hardening-v1`

Supersedes: the future-function default-privilege mechanism in `docs/superpowers/specs/2026-09-08-phase-9c-database-rpc-hardening-design.md`

## Reason for amendment

Live post-migration acceptance exposed a PostgreSQL default-privilege semantic that the original design treated incorrectly.

The initial Phase 9C migration used schema-scoped statements such as:

```sql
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated, service_role;
```

PostgreSQL does not allow a schema-scoped default `REVOKE` to subtract privileges supplied by the global or hard-wired default privilege set. New functions have a hard-wired `PUBLIC EXECUTE` default. Therefore the schema-scoped `REVOKE ... FROM PUBLIC` does not establish the intended deny-by-default invariant for future functions.

The live `pg_default_acl` result proved this directly: after the initial migration, the `public` schema had a schema-local function ACL row, but `private` had no such row and the hard-wired global `PUBLIC EXECUTE` behavior remained relevant.

## Why the obvious global correction is rejected

A technically effective PostgreSQL command would be a global owner default change such as:

```sql
alter default privileges for role postgres
  revoke execute on functions from public;
```

Phase 9C must not apply that change.

Live ownership inventory proves role `postgres` owns functions outside ScopeForge application schemas, including dozens of extension functions in schema `extensions`. A global owner default would affect future objects created by that role regardless of application schema and could alter managed extension installation or upgrade semantics.

Changing managed database behavior to enforce an application migration convention is a larger and riskier authority change than the problem warrants.

Phase 9C therefore rejects a global `postgres` default-privilege mutation and continues to leave `supabase_admin` defaults untouched.

## Corrected architecture

### Existing functions

The permanent ACL hardening already applied to the 17 identified trigger-only private functions remains valid and is the primary Phase 9C database control.

Each target function must remain non-executable by:

- `PUBLIC`
- `anon`
- `authenticated`
- `service_role`

The two RLS helpers remain the only authenticated private function interface:

- `private.is_workspace_member(uuid)`
- `private.has_workspace_role(uuid, public.workspace_role[])`

### Future application functions

Future `public` or `private` application functions are controlled at the repository migration boundary rather than by a global managed-database default.

Every migration after `20260908170000_phase_9c_function_acl_hardening.sql` that creates or replaces a `public` or `private` function must contain an explicit `REVOKE` for that function in the same migration.

Intentionally callable functions must then add the narrowest explicit `GRANT` required by their interface.

This follows ScopeForge's existing worker-control migration pattern, where function creation is immediately followed by revocation and a narrowly scoped grant to `service_role` where required.

### Permanent regression guard

`tests/architecture/phase-9c-database-rpc-hardening.test.ts` must:

1. preserve the exact ACL expectations for the 17 hardened trigger-only functions
2. preserve authenticated access to the two RLS helpers and schema `private`
3. reject a global `postgres` function-default revoke in the Phase 9C migration
4. reject changes to `supabase_admin` default privileges
5. scan every later SQL migration for `CREATE FUNCTION` or `CREATE OR REPLACE FUNCTION` in `public` or `private`
6. require an explicit same-migration function `REVOKE` for each created application function

This makes accidental future exposure a CI failure without modifying Supabase-managed extension semantics.

## Live-state interpretation

The schema-scoped default-privilege statements already recorded by the applied Phase 9C migration are left in migration history. Deployed migration history is immutable.

They are not used as evidence that future functions are deny-by-default and must not be described that way in release documentation.

No forward migration is required merely to remove those schema-local ACL rows because they do not widen current function authority, and changing them would not solve the hard-wired global default. The effective future-function control is the repository regression guard.

## Updated success criteria

Phase 9C v1 succeeds when:

- all 17 identified trigger-only private functions have no direct execution authority for `PUBLIC`, `anon`, `authenticated`, or `service_role`
- authenticated RLS helper execution and `private` schema usage remain intact
- private worker tables remain inaccessible to browser roles
- public privileged worker/control RPCs remain inaccessible to browser roles
- all target trigger bindings remain enabled and the live PostgreSQL canary proves they still fire after direct execution is revoked
- relevant `SECURITY DEFINER` functions keep an empty pinned search path
- the architecture test requires explicit ACL revocation for every future `public` or `private` application function migration
- no global `postgres` default-function mutation is introduced
- `supabase_admin` defaults remain untouched
- no deployed migration is rewritten
- no legacy table-grant, provider, UI, or runtime-authority change is bundled into Phase 9C v1

This amendment is authoritative wherever it conflicts with the original Phase 9C design's future-function default-privilege section.
