# Private worker-table RLS hardening plan

Last reconciled: 2026-09-22, Asia/Singapore.

This is a defense-in-depth design record, not authorization to change production before the final Phase 11 canary.

## Current production facts

Supabase currently reports nine private worker/runtime tables with RLS disabled:

- `private.worker_nodes`
- `private.worker_tasks`
- `private.worker_attempts`
- `private.worker_events`
- `private.repository_snapshot_tasks`
- `private.repository_snapshot_attempt_uploads`
- `private.repository_source_artifacts`
- `private.repository_scan_tasks`
- `private.runtime_worker_tasks`

Live inspection on 2026-09-22 confirmed all nine tables:

- are owned by `postgres`
- have `relrowsecurity = false`
- have `relforcerowsecurity = false`
- have no RLS policies
- expose table privileges only to the `postgres` owner in the inspected grant view
- expose no direct `anon` or `authenticated` table grant
- are referenced by 57 inspected `SECURITY DEFINER` routines across the trusted worker/control surface

The worker/control plane accesses these tables through reviewed `SECURITY DEFINER` functions and trusted server paths. That means a blanket `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` change is not safe merely because the advisor recommends RLS.

## Why this is not a one-line remediation

PostgreSQL table owners normally bypass RLS unless `FORCE ROW LEVEL SECURITY` applies. ScopeForge also relies on security-definer functions whose execution identity and ownership are part of the trusted worker boundary.

A correct hardening slice therefore has to prove all of the following before production:

1. which function owner executes each claim, heartbeat, finalization, recovery, snapshot, scan, artifact, and event path
2. whether ordinary `ENABLE ROW LEVEL SECURITY` changes any trusted function behavior at all
3. whether `FORCE ROW LEVEL SECURITY` would break owner-executed control functions
4. whether service-role/server access depends on direct table access anywhere outside those functions
5. whether recovery and cancellation paths still work when a worker dies mid-lease
6. whether repository snapshot/scan publication and cleanup remain atomic
7. whether browser roles remain unable to read or mutate these tables
8. whether migration rollback is possible without losing task/attempt state

## Recommended hardening sequence

### Stage 1 - audit only

Run:

`scripts/worker-rls-hardening-audit.sql`

Require the same high-level posture before proceeding:

- zero `anon` or `authenticated` table grants
- expected table owner unchanged
- reviewed security-definer functions still form the mutation boundary
- no surprise policy or direct browser path has appeared

### Stage 2 - disposable database validation

Do not start on production.

On an isolated Supabase branch or equivalent disposable PostgreSQL environment:

1. replay the current migrations
2. enable RLS on one worker-table family at a time
3. do not use `FORCE ROW LEVEL SECURITY` initially
4. run the worker-control database suites for claim, heartbeat, finalization, retry, recovery, cancellation, and replay
5. run repository snapshot/scan database suites separately
6. prove browser roles still have zero direct table authority
7. inspect whether RLS is actually adding protection under the current owner/security-definer execution identity

If ordinary RLS is bypassed by the trusted owner as expected, record that result rather than pretending the advisor warning has been materially remediated.

### Stage 3 - explicit role/policy redesign only if justified

If stronger isolation is required, design a dedicated non-owner execution role and explicit policies instead of forcing RLS on `postgres`-owned tables.

That redesign must include:

- least-privilege execution role
- explicit schema/table/function grants
- pinned empty `search_path`
- no browser execution grants unless independently authorized
- tested recovery/cancellation/finalization behavior
- forward migration and rollback procedure
- exact production canary after deployment

This is a separate architecture change and must not be bundled into Phase 11 closure.

## Decision for the current release

Do not change these nine tables before the final Phase 11 production canary.

The current browser exposure is already constrained by the absence of direct browser grants, while an untested RLS change could break the trusted worker control plane. Treat the advisor as tracked defense-in-depth work after Phase 11 operational acceptance.
