# Workspace collaborator controls - working state

Last updated: 2026-09-16, Asia/Singapore

## Live baseline

- Repository: `LeDoNguyenTu/ScopeForge`.
- Branch: `feat/workspace-collaborator-controls-20260916` from main `17ee530`.
- Signup repair PR #117 merged as `12a2609458d8b4c7369e2bb7d4926dd686a84769`; production deployment `dpl_5QLmhM2ztPJuJ8PYrjeEcKBTh8Qu` is READY.
- ScopeForge Supabase project is `tdgpibrepzcvdivztkta`. Never use `xwsergbpvkcsugexssmc`.
- Supabase Auth Site URL and the exact production callback were corrected and verified. See `SIGNUP_CONFIRMATION_ACCEPTANCE.md`.
- Issue #79 remains the Phase 10 release gate. PR #76 must follow #79; PR #77 must follow released #76.

## User request and production membership

The user correctly identified that ScopeForge had no owner-facing collaborator UI. The user selected Brian's workspace for the designated collaborator. A guarded idempotent insert already added that confirmed account as `member` of Brian's workspace; its existing `owner` role in Meo's workspace remains unchanged.

Do not reorder membership timestamps, downgrade an owner, or fabricate membership to make a canary pass. The member negative provider canary requires the collaborator to select Brian's workspace through the normal application UI and authenticate normally.

## Implementation on this branch

- New `/dashboard/workspace` page lists the signed-in user's memberships, switches the active workspace, and exposes collaborator controls only to an owner/admin.
- Active selection is stored in an HTTP-only, same-site cookie bound to the authenticated user. The cookie is only a preference: each consumer still verifies current membership server-side.
- GitHub connection initiation, hosted import, asset actions, and dashboard context honor the selected workspace. Operations receiving a workspace ID retain their existing explicit membership checks.
- Owners/admins can add an existing confirmed, unsuspended ScopeForge account as `member` or `viewer`, change those two roles, and remove them. The UI cannot grant owner/admin roles or edit protected owner/admin memberships.
- Forward-only migration `20260916040000_workspace_collaborator_controls.sql` provides session-scoped security-definer RPCs, locks authorization and the workspace in the write transaction, rejects suspended actors/targets, writes bounded audit events, and revokes anonymous/public execution.
- Platform admin has a distinct outlined control and spacing from Resources. Backup platform-admin delegation and ACM are explicitly deferred in `BACKUP_ADMIN_FUTURE.md`; this branch does not grant or expose platform privileges.
- Preview-only `/preview/workspace` supplies synthetic rendered browser evidence without bypassing production authentication.

## TDD and validation evidence

RED evidence was captured for missing active-workspace selection and missing Workspace navigation. The focused implementation suite now passes 8 files / 49 tests, including:

- user-bound cookie parsing and malformed/cross-account rejection;
- server-action input validation and membership verification before cookie persistence;
- member/viewer-only role surface and protected owner UI;
- PostgreSQL execution of the migration for owner success, member and anonymous denial, suspended-owner denial, protected-role rejection, confirmed-account eligibility, bounded audit data, and rollback when audit insertion fails;
- GitHub authorization and hosted import regression coverage;
- typecheck and Next production build.

Docker Desktop was unavailable, so the database integration suite uses pinned PGlite `0.5.8`. Production migration application, exact-candidate CI, Vercel preview, screenshots, and live authenticated browser acceptance remain pending. Do not apply the migration or merge until the candidate passes CI and the rendered preview is inspected.

## Ordered continuation

1. Inspect the branch diff and run audit, full tests, typecheck, CLI/version, benchmarks, and a clean Next build.
2. Commit and push without AI attribution; open a focused PR.
3. Require exact-head Linux CI and Vercel READY. Download and inspect 390px and desktop workspace-control screenshots.
4. Re-read production migration history, apply only the absent reviewed collaborator migration to `tdgpibrepzcvdivztkta`, then verify function grants and live behavior. This is independent of Phase 10A2/10A3 migrations, which remain unapplied.
5. Merge only after code, migration, responsive UI, security boundaries, and rollback behavior are accepted. Verify production deployment exact SHA.
6. Use the designated collaborator's normal authenticated session to select Brian's workspace and prove the #79 member Connect GitHub denial. Do not claim the canary from unit tests or database membership alone.
7. The unrelated-installation #79 canary remains separately required before releasing #76.
