# Workspace collaborator controls - release acceptance

Last updated: 2026-09-16, Asia/Singapore

## Released state

- Repository: `LeDoNguyenTu/ScopeForge`.
- PR: #118, `Add workspace collaborator controls`.
- Exact candidate: `3657b5c1d83b39c14bf7c414f3ec5290da95cc5e`.
- Merge on `main`: `d0a2521879fb76d5a7b2c013add11536f0dc3fd4`.
- Production deployment: `dpl_9cH2czWFWLWj8Y6wPZE4V3xikiPR`, READY for the merge SHA and aliased to `scopeforge.dev`.
- ScopeForge Supabase: `tdgpibrepzcvdivztkta`. Never use `xwsergbpvkcsugexssmc`.
- Production migration history records `20260916005453_workspace_collaborator_controls`. This was a forward-only application of repository migration `20260916040000_workspace_collaborator_controls.sql`.
- Issue #79 remains the Phase 10 release gate. PR #76 must follow #79; PR #77 must follow released #76.

## User request and production membership

The user correctly identified that ScopeForge had no owner-facing collaborator UI. The designated confirmed collaborator is now a `member` of Brian's workspace while retaining `owner` of Meo's workspace. No owner role was downgraded or transferred.

The collaborator's normal authenticated session is still required to select Brian's workspace and perform the issue #79 member Connect GitHub denial canary. The production browser available during release validation was signed out, so this canary has not been claimed from database membership, unit tests, or an owner session.

## Released implementation

- `/dashboard/workspace` lists the signed-in user's memberships, switches the active workspace, and shows collaborator controls to owners/admins.
- Active selection uses an HTTP-only SameSite=Lax cookie bound to the authenticated user. It is a preference only; every consumer revalidates current membership server-side.
- Dashboard context, GitHub connection initiation, hosted import, and asset actions honor the selected workspace. Operations receiving an explicit workspace ID retain explicit membership checks.
- Owners/admins can add an existing confirmed, unsuspended account as `member` or `viewer`, change those two roles, and remove them.
- The UI and RPC cannot grant owner/admin roles or edit protected owner/admin memberships.
- The migration provides session-scoped security-definer RPCs, locks authorization and the workspace during writes, rejects suspended actors/targets, writes bounded audit events, and revokes anonymous/public execution.
- Platform admin is a distinct outlined control with visual space from Resources.
- Backup platform-admin delegation and ACM remain explicitly deferred in `BACKUP_ADMIN_FUTURE.md`; this release grants no platform privilege.
- `/preview/workspace` supplies synthetic responsive evidence without bypassing production authentication.

## TDD and local validation

RED evidence was captured for missing active-workspace selection and missing Workspace navigation. Final focused validation passed 8 files / 49 tests, including:

- user-bound cookie parsing and malformed/cross-account rejection;
- server-action validation and membership verification before cookie persistence;
- member/viewer-only role surface and protected owner UI;
- PostgreSQL-compatible execution of the migration for owner success, member and anonymous denial, suspended-owner denial, protected-role rejection, account eligibility, bounded audit data, and rollback when audit insertion fails;
- GitHub authorization and hosted import regression coverage.

The full local suite passed 401 files with 1,774 tests and 4 files / 24 tests skipped for unavailable platform capabilities. Audit reported zero vulnerabilities. Typecheck, CommonJS CLI build/version (`ScopeForge 0.1.0`), scanner and matrix benchmarks, and the optimized Next build passed.

Docker Desktop was unavailable, so the focused database integration suite used pinned PGlite `0.5.8`. Exact-head Linux CI then ran the complete non-skipped suite.

## Exact-candidate CI and rendered acceptance

- Exact-head CI run `35041678098`, job `104622688275`: SUCCESS on `3657b5c1d83b39c14bf7c414f3ec5290da95cc5e`.
- Linux result: 405/405 test files and 1,798/1,798 tests passed.
- Audit, typecheck, CLI build/version, scanner benchmark, matrix benchmark, optimized Next build, strict-CSP browser smoke, production diagnostic, and artifact upload all passed.
- Exact preview `dpl_2ZhsoyPcpKy5HorZFjWkEs3FC4ou`: READY on the exact candidate.
- The generated 390px and 1440px workspace screenshots were inspected. The mobile layout stacks without horizontal page overflow, and the Platform admin control has a distinct style and at least 12px separation from Resources.
- Post-merge CI run `35042019694`, job `104623720526`: SUCCESS on merge SHA `d0a2521879fb76d5a7b2c013add11536f0dc3fd4`. All audit, 405/405 files and 1,798/1,798 tests, typecheck, CLI, benchmark, build, CSP-browser, production-diagnostic, and artifact steps passed.

## Production database acceptance

Before application, production history ended at `20260911143049_phase_10a1_service_role_table_acl_hardening`; Phase 10A2 and Phase 10A3 migrations were absent and remain unapplied.

Only the collaborator-controls migration was applied. Live SQL acceptance proved:

- an active owner can list the workspace roster;
- a normal member receives `insufficient_privilege` for the management roster RPC;
- anonymous execution is denied;
- `authenticated` has execute access to both scoped RPCs while `anon` does not;
- the designated account still has the intended Brian-workspace member role and its separate Meo-workspace owner role.

Supabase's advisor flags the two authenticated-callable security-definer RPCs. This is intentional for these narrow APIs because they need controlled `auth.users` lookup and enforce `auth.uid()`, active-account, active-membership, workspace-role, target-state, protected-role, and audit checks inside the transaction. The exact behavior and grants are covered by migration integration tests and live SQL acceptance. Other advisor findings were pre-existing; this migration adds no foreign keys or indexes.

## Remaining release gate

1. Sign in normally as the designated collaborator at `scopeforge.dev`.
2. Open Workspace, select Brian's workspace, and verify the page shows the collaborator as `member` without owner/admin management controls.
3. Attempt Connect GitHub and capture the expected authorization denial for issue #79. Do not weaken provider authorization or simulate this canary.
4. Complete the separate unrelated-installation negative canary required by issue #79.
5. Only after #79 clears may PR #76 be reconciled/released; PR #77 follows released #76.
