# ScopeForge Phase 9 Working State

Last reconciled: 2026-09-08 (Asia/Singapore)

## Current Phase 9 status

- Phase 9 design: approved and committed
- Phase 9A authentication boundary: complete and released
- Phase 9B provider/edge abuse controls: pending separate operational acceptance
- Phase 9C database/RPC defense-in-depth: implemented in production database, release candidate preparation in progress
- Phase 9D telemetry/browser hardening: pending
- Phase 9E incident/release hardening: pending

Dashboard V5/UI PR #49 remains a separate workstream and has not been modified by Phase 9.

## Phase 9A released state

Released main:

- commit: `5c08003c8bf8cb920832431a346c9254aae92239`
- tree: `6c62f5223269597171bdb5caa39f647b4106a03f`
- PR: #58
- final PR head: `386308657bca0d8ba66f86074992d9983db600ba`
- PR CI #767: success
- post-merge main CI #768: success
- production deployment: `dpl_BePDHoKDzWPXU6L2PX3Rj8bpTTue`, READY, `aliasError=null`

## Phase 9C branch state

Branch:

`feat/phase-9c-database-rpc-hardening-v1`

Released baseline:

`c4aaf76a08960d68159d9c96f053e38e7963a859`

Approved design:

`docs/superpowers/specs/2026-09-08-phase-9c-database-rpc-hardening-design.md`

Corrective design amendment after live PostgreSQL validation:

`docs/superpowers/specs/2026-09-08-phase-9c-default-acl-amendment.md`

Implementation plans:

- `docs/superpowers/plans/2026-09-08-phase-9c-database-rpc-hardening.md`
- `docs/superpowers/plans/2026-09-08-phase-9c-default-acl-amendment.md`

### Test-first ordering

Architecture test-only commit:

`72d5d75ecf5e16e775eaa95ed7ac9ddb083a95ef`

At that exact commit the required migration path did not exist, providing structural RED evidence. This harness has no local checkout, so Vitest RED was not executed and must not be described as executed.

Initial ACL migration commit:

`849109b14dc741d75c3d8f43983127de01bb90d4`

Architecture correction guard commit:

`906fd1e3313eac2769f4575dcd2111b69e82ff59`

The correction guard enforces explicit same-migration function revocation for every future `public` or `private` function migration and rejects global `postgres` default-function revocation or `supabase_admin` default changes.

## Live Supabase Phase 9C evidence

Project:

`tdgpibrepzcvdivztkta`

PostgreSQL engine during preflight and canary:

`17.6`

Live migration history entry:

`20260908084554_phase_9c_function_acl_hardening`

Repository migration source:

`supabase/migrations/20260908170000_phase_9c_function_acl_hardening.sql`

### Preflight

Immediately before DDL:

- all nine private worker tables had no SELECT/INSERT/UPDATE/DELETE privilege for `anon` or `authenticated`
- `authenticated` had intentional `USAGE` on schema `private`
- `private.is_workspace_member` and `private.has_workspace_role` were the intentional authenticated private helpers
- all 17 target trigger-only functions still had unnecessary inherited direct execution
- public privileged worker/control RPCs were inaccessible to `anon` and `authenticated`
- relevant `SECURITY DEFINER` functions had pinned empty search paths
- target trigger bindings existed and were enabled

### Trigger ACL canary

A transaction-scoped disposable canary was executed before permanent migration:

- a private canary table, trigger function, and trigger were created
- direct function execution was revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`
- DML was executed under `authenticated`
- the trigger still fired and changed the canary marker to `fired`
- the transaction was rolled back
- catalog cleanup proof returned NULL for both canary table and function

No application table or user data was modified by the canary.

### Permanent ACL result

The live migration successfully removed direct execution for all 17 target trigger-only functions from:

- `PUBLIC`
- `anon`
- `authenticated`
- `service_role`

Post-migration acceptance shows:

- target execution violations: zero
- private worker-table privilege violations: zero
- public privileged RPC browser-role violations: zero
- missing/disabled target triggers: zero
- bad `SECURITY DEFINER` search paths: zero
- `authenticated` private-schema usage: preserved
- `private.is_workspace_member`: authenticated-only execution preserved
- `private.has_workspace_role`: authenticated-only execution preserved

A real transaction-scoped `authenticated` RLS check using an existing membership returned only booleans and proved:

- a workspace was visible through RLS
- `private.is_workspace_member` was operational
- `private.has_workspace_role` was operational

No identifying user or workspace data was returned by the acceptance result.

## Default ACL correction

Initial live acceptance found that schema-scoped `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ... FROM PUBLIC` does not override PostgreSQL's hard-wired global `PUBLIC EXECUTE` default for functions.

A global owner default revoke was rejected after live blast-radius analysis showed role `postgres` also owns managed extension functions outside ScopeForge application schemas. Phase 9C therefore does not alter global `postgres` defaults or any `supabase_admin` defaults.

Future application function hardening is enforced at the repository migration boundary instead:

- any later migration that creates or replaces a `public` or `private` function must contain an explicit same-migration function revoke
- intentionally callable functions must then add only the narrow explicit grant required

The schema-local default ACL statements already recorded in deployed migration history are not treated as evidence for future-function denial. Deployed migration history remains immutable.

## Security Advisor

After Phase 9C DDL, the Supabase Security Advisor still reports exactly one warning:

- `auth_leaked_password_protection`

This is a pre-existing Phase 9 provider-control item and is not a Phase 9C database regression.

## Remaining Phase 9C release gates

Before merge/release completion:

1. update resumable handoff docs - in progress
2. verify branch diff scope
3. verify exact-head Vercel Preview READY
4. freeze one exact candidate
5. execute one substantive GitHub Actions validation on that candidate
6. require npm audit, full Vitest suite, typecheck, CLI build/version, historical benchmark, Phase 8B matrix, and production Next build to pass
7. recheck exact base/head, PR review state, combined status, and scope
8. squash-merge exact verified head
9. independently verify main CI and exact production Vercel deployment
10. write one docs-only Phase 9C release checkpoint

Vitest has not yet executed for Phase 9C in this harness. Final frozen CI is the first executable test gate for the new architecture test.

## Pending provider hardening

Still pending outside Phase 9C:

- leaked-password protection
- Turnstile
- Auth rate-limit changes
- Vercel WAF/rate limits
- telemetry/alerts
- CSP
- incident/release hardening
- legacy `anon` table-grant cleanup on `profiles`, `workspaces`, and `workspace_members`

## Runtime authority boundary

Keep false/absent unless separately authorized:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 9C does not authorize hosted execution.
