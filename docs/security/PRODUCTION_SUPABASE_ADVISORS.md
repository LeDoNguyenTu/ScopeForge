# Production Supabase Advisor Reconciliation

Last reconciled: 2026-09-21, Asia/Singapore.

This record distinguishes actionable security defects from intentional private/trusted-server boundaries. Live provider state wins over this file.

## Browser table authority

A live grant query across the Phase 10/11 private planning, GitHub reconciliation, and worker tables returned zero direct table privileges for both `anon` and `authenticated`.

This includes all 17 private tables currently reported by Supabase as **RLS enabled with no policy**. For those tables, no browser policy is intentional: the application uses narrow trusted RPC/server paths rather than direct browser table access.

## RLS-disabled private worker tables

Supabase separately reports nine private worker/runtime tables with RLS disabled:

- `private.worker_nodes`
- `private.worker_tasks`
- `private.worker_attempts`
- `private.worker_events`
- `private.repository_snapshot_tasks`
- `private.repository_snapshot_attempt_uploads`
- `private.repository_source_artifacts`
- `private.repository_scan_tasks`
- `private.runtime_worker_tasks`

Live grant inspection returned zero `anon` or `authenticated` privileges on every one of these tables.

This is still a defense-in-depth hardening item. Do **not** enable RLS automatically. A forward change must first prove the exact trusted worker/service-role/table-owner behavior and add tested policies where required so worker execution, recovery, publication, and cleanup do not fail closed unexpectedly.

## Authenticated SECURITY DEFINER collaborator RPCs

Supabase reports two authenticated-callable `SECURITY DEFINER` functions:

- `public.list_workspace_collaborators(uuid)`
- `public.manage_workspace_collaborator(uuid,text,text,uuid,public.workspace_role)`

This execution grant is intentional. These functions need bounded access to `auth.users`, while the caller remains session-bound.

The released functions:

- derive the actor from `auth.uid()`, never a supplied actor ID
- require workspace `owner` or `admin` role
- reject deleted or currently banned callers
- protect owner/admin members from routine collaborator mutation
- serialize mutation authorization with row locks
- keep an empty pinned `search_path`
- revoke execution from `public` and `anon`
- audit collaborator mutations

Do not revoke authenticated execution or convert these functions to invoker rights without replacing the required `auth.users` access model and rerunning the collaborator database tests.

## Leaked-password protection

Supabase reports leaked-password protection disabled. The connected ScopeForge organization currently reports plan `free`, so this provider feature is not actionable through the current project plan/tooling. Re-evaluate it after any Supabase plan change.

## Performance advisor

Foreign-key index findings are tracked separately from security authority. Additive index hardening may proceed independently because it does not widen browser, worker, or scanner authority.

## Reconciliation rule

Advisor output is evidence, not an instruction to apply generic remediation mechanically. Every database hardening change must preserve the explicit ScopeForge trust boundary and be validated as a forward migration.
