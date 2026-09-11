# Phase 10A1 GitHub Connected Projects Release State

Last reconciled: 2026-09-11 (Asia/Singapore)

## Scope

Phase 10A1 implements the public-repository connected-project core:

1. connect a workspace to a GitHub App installation,
2. prove the signed-in GitHub user can access that installation,
3. browse repositories through short-lived installation credentials,
4. import a repository as a verified ScopeForge repository asset,
5. start one project-level scan action,
6. publish an immutable source snapshot,
7. continue to the repository scanner without exposing snapshot/worker internals as the primary UX,
8. safely resume the exact already-published snapshot when continuation is delayed or retried.

Private repository acquisition remains a separate Phase 10A2 execution class. Phase 10A1 never routes private source through the public acquisition worker.

## Current release candidate

PR: #74
Branch: `feat/phase-10a-github-connected-projects`
Exact executable/schema candidate before this documentation reconciliation: `a8959d4b887463b0b28af056932eabd2a75147a3`
Validation: CI #907 / run `34610625305` - SUCCESS

CI #907 passed end-to-end against the PR merge result:

- dependency installation,
- `npm audit --audit-level=info` with zero reported vulnerabilities,
- 387 test files / 1,720 tests,
- TypeScript typecheck,
- CLI build and version execution,
- scanner benchmark,
- scanner matrix benchmark,
- Next.js production build,
- strict-CSP browser smoke,
- production V5/Turnstile diagnostic,
- visual acceptance artifact upload.

The additional test is the permanent service-role table ACL regression guard added during production schema review.

## Production Supabase state - verified

ScopeForge production project: `tdgpibrepzcvdivztkta`.

A fresh production migration read and targeted SQL verification succeeded on 2026-09-11. Production now records all Phase 10A1 forward migrations:

- `20260910160000_phase_10a1_github_connected_projects`
- `20260910160010_phase_10a1_project_scan_retry_idempotency`
- `20260910160020_phase_10a1_project_scan_waiting_idempotency`
- `20260910160030_phase_10a1_project_scan_recovery`
- `20260911143049_phase_10a1_service_role_table_acl_hardening`

The fifth migration was added after live ACL inspection found that Supabase's trusted `service_role` retained default table privileges beyond application need. TDD evidence for the hardening was explicit:

- RED commit `e5ffd6a8e640483adec01d1856878f78f4114c83`: 1,719 existing tests passed and the one new ACL test failed only because the forward migration did not yet exist.
- GREEN candidate `a8959d4b887463b0b28af056932eabd2a75147a3`: all 1,720 tests and the complete CI matrix passed.

Live table privileges after hardening are:

- `authenticated`: `SELECT` only on `public.github_connections` and `public.github_repository_links`,
- `service_role`: `SELECT`, `INSERT`, `UPDATE`, `DELETE` only on those two tables,
- no retained `TRUNCATE`, `REFERENCES`, or `TRIGGER` table privilege for `service_role`.

Targeted production verification also confirmed:

- both public GitHub tables have RLS enabled,
- browser mutation authority is absent,
- `private.github_project_scan_intents` has RLS enabled and no browser/service-role direct table grant,
- Phase 10A1 privileged public RPCs remain `SECURITY DEFINER`, use pinned empty search paths, and grant execution only to `service_role`.

Security Advisor after hardening reports no Phase 10A1 release-blocking schema finding. The remaining findings are:

- INFO: `private.github_project_scan_intents` has RLS enabled with no policies; this is intentional for its private service-only boundary,
- WARN: Supabase leaked-password protection is disabled; this predates Phase 10A1 and remains a separate Auth follow-up.

## Security and correctness properties

- GitHub App configuration is server-only; no provider secret uses a `NEXT_PUBLIC_` variable.
- Connection state is signed, time-bounded, and bound to the exact ScopeForge user/workspace.
- GitHub setup `installation_id` is not treated as proof of ownership. Persistence occurs only after the authenticated GitHub user proves access to that installation.
- Temporary GitHub user OAuth tokens and installation tokens are not persisted.
- Installation tokens are short-lived, read-only, and repository-scoped when operating on one repository.
- Repository import accepts only a numeric repository ID from the browser and re-fetches authoritative metadata through GitHub.
- Integration mutations are owner/admin-only and server-side.
- Browser-visible connection/link tables are read-only through workspace-scoped RLS; worker intent remains private.
- Public and private repository execution classes remain separated.
- Hosted repository snapshot and scan runtime gates remain independently fail-closed.
- Exact-snapshot recovery cannot silently select a newer repository snapshot.

## GitHub App / Vercel provider gate - still open

Provider requirements are documented in `PHASE_10A1_GITHUB_APP_SETUP.md`.

The connected Vercel surface available in this session does not expose project environment-variable metadata, so the presence of the six required server-only GitHub App settings cannot be truthfully verified from Vercel configuration.

A recent Phase 10A1 Vercel preview (`dpl_7gyL7zWg8qh8WE549sFxUi9JXa9K`) is READY and its build includes the GitHub connect/callback and integration routes. Recent production logs contain no matching `Missing server-only GitHub App setting` error, but neither fact proves the provider credentials are configured because GitHub App configuration is loaded only inside the authenticated owner/admin connection flow.

Production database verification currently shows zero rows in both `github_connections` and `github_repository_links`. Therefore no live Connect GitHub -> installation proof -> repository listing -> import canary has completed yet.

Do not classify Phase 10A1 as production-active or merge PR #74 solely from code/schema success. The live provider canary remains the final release gate.

## Hosted runtime flags

Do not enable these as part of Phase 10A1 release alone:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Their independent containment/canary/rollback acceptance remains mandatory.

## Remaining release gates

1. Verify the six required server-only GitHub App settings through a supported configuration surface without exposing values.
2. Verify the GitHub App provider uses the documented production homepage/setup/callback URLs and read-only repository permissions.
3. Perform one authenticated owner/admin live Connect GitHub -> installation proof -> repository list -> repository import acceptance.
4. Confirm no provider token, App private key, signed state, or installation credential appears in browser state, persisted integration rows, redirects, or ordinary application logs.
5. Keep hosted worker capability flags off.
6. Run final exact-head CI after this documentation reconciliation.
7. Merge PR #74 only after the provider canary succeeds and the final head remains green.
8. Verify the merged production deployment before reconciling stacked PR #76 onto released `main`.

## Phase 10A2 stack

PR #76 already implements the distinct private-repository acquisition path and remains draft/stacked on the Phase 10A1 branch. Its previously validated head passed its own complete CI matrix, but it must not merge before Phase 10A1 releases. Because the Phase 10A1 branch advanced with the ACL-hardening commits, PR #76 will require stack reconciliation and complete revalidation after Phase 10A1 is released.
