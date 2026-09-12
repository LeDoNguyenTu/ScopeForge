# Phase 10A1 GitHub Connected Projects Working State

Last reconciled: 2026-09-12 (Asia/Singapore)
Branch: `feat/phase-10a-github-connected-projects`
PR: #74
Status: implementation and production schema verification complete; live GitHub App provider canary still gated

## Implemented

- Shared strict boolean runtime-capability parser for hosted repository snapshot and repository scan gates.
- Server-only GitHub App configuration with no public-secret fallback.
- Ten-minute signed user/workspace connection state and constant-time signature verification.
- RS256 GitHub App JWT signing using Node crypto.
- Bounded GitHub provider client for OAuth exchange, user installation proof, installation tokens, repository listing and repository-ID lookup.
- Installation tokens request only `contents: read` and `metadata: read`; single-repository operations are repository-scoped.
- Provider response/error normalization prevents raw provider bodies or tokens from reaching browser responses.
- `github_connections` and `github_repository_links` schema with same-workspace composite foreign keys and read-only browser RLS.
- Owner/admin-only connection flow that does not trust GitHub setup `installation_id` by itself.
- Temporary GitHub user OAuth tokens are discarded after installation verification.
- Owner/admin-only repository discovery and import.
- Browser sends only numeric repository ID; authoritative metadata is re-fetched with a repository-scoped installation token.
- GitHub-confirmed repositories are registered/reused as verified ScopeForge repository assets with idempotent links.
- Private repositories may be linked but remain outside the Phase 10A1 public acquisition execution class.
- Connected-project dashboard UX presents one project-level scan action while retaining existing manual repository tools.
- Public connected-project scan orchestration persists private worker intent, queues immutable source acquisition, and automatically continues after successful snapshot publication.
- Project-level read model exposes only bounded safe state.
- Exact-snapshot recovery supports `waiting_scan_runtime`, `retry_pending`, and idempotent `scan_queued` replay without implicit source reacquisition.

## Production database verification completed

Correct ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Production currently records five Phase 10A1 migrations:

- `20260910160000_phase_10a1_github_connected_projects`
- `20260910160010_phase_10a1_project_scan_retry_idempotency`
- `20260910160020_phase_10a1_project_scan_waiting_idempotency`
- `20260910160030_phase_10a1_project_scan_recovery`
- `20260911143049_phase_10a1_service_role_table_acl_hardening`

The final forward migration was added after live review found trusted `service_role` inherited table privileges beyond application need. It now has only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on the two public GitHub integration tables. Authenticated browser users retain `SELECT` only.

Live checks confirm RLS/browser-write boundaries, private intent-table isolation, pinned `SECURITY DEFINER` search paths, and service-role-only privileged RPC execution.

Security Advisor has no Phase 10A1 release-blocking schema finding. The private intent table's no-policy INFO is intentional for the private service-only boundary. Leaked-password protection remains a separate plan-gated Auth follow-up.

## TDD / validation history

- Recovery RED checkpoint `b776ab78b61b490be04a8121bb07958d36ed19f2`: 1,711 existing tests passed and exactly eight new recovery assertions failed.
- Recovery GREEN candidate `005504387cf29d65d6b297acb041b608f0416c1a`: CI #852 / run `34520609482` SUCCESS.
- ACL-hardening RED checkpoint `e5ffd6a8e640483adec01d1856878f78f4114c83`: all 1,719 existing tests passed and exactly the new migration-presence assertion failed.
- ACL-hardening GREEN candidate `a8959d4b887463b0b28af056932eabd2a75147a3`: CI #907 / run `34610625305` SUCCESS.
- Fresh current-main synthetic validation CI #949 / run `34656537969`: SUCCESS on Phase 10A1 head `17831b98dbbf06adf213cd2c8694ecd0d6852b74` merged into released `main` `1151af2dddb76737ee2f0a0d1a802f06a975d318`.

Fresh CI #949 passed:

- dependency audit with zero reported vulnerabilities,
- 387 test files / 1,720 tests,
- TypeScript typecheck,
- CLI build/version,
- scanner benchmark,
- benchmark matrix,
- Next.js production build,
- strict-CSP browser smoke,
- production V5/Turnstile diagnostic,
- visual artifact upload.

## Release-gate hardening RED candidate

A provider-side preview probe on 2026-09-12 found that the Phase 10A1 preview route exists but an unauthenticated `/api/integrations/github/connect` request redirects to `http://localhost:3000/...` when `NEXT_PUBLIC_SITE_URL` is absent in Preview. The callback itself already falls back to the request origin; the connect route did not.

More importantly, the integration page currently exposes the live `Connect GitHub` action immediately after merge even though the real production GitHub App canary cannot be completed safely on Preview because GitHub's setup/callback URL is intentionally fixed to `scopeforge.dev`.

New RED contracts now require:

- a default-off server capability `HOSTED_GITHUB_INTEGRATION_ENABLED`,
- connect and callback routes to fail closed before provider/OAuth work while that capability is disabled,
- the disconnected dashboard to hide the live Connect action while disabled,
- local connect-route errors to fall back to the actual request origin instead of `localhost` when no canonical site URL is configured.

The release pattern after GREEN will therefore be: merge dark-gated code, production-verify provider configuration/canary, then deliberately enable the GitHub integration. Hosted snapshot/scan worker gates remain independently default-off.

## Released baseline

Current released `main`: `1151af2dddb76737ee2f0a0d1a802f06a975d318`.
Current production domain: `scopeforge.dev`.
The Phase 10C admin/V5/CSP baseline remains authoritative until PR #74 is safely merged and production-verified.

## Provider state

The live GitHub App provider gate is not yet complete.

The required server-only Vercel variables remain:

- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_STATE_SECRET`

The connected Vercel surface in this session does not expose environment-variable metadata, so configuration presence cannot be asserted from tooling. A READY Phase 10A1 preview proves the app builds with the integration routes, but GitHub App setup/callback is production-bound and therefore needs a real production provider acceptance.

Production currently has no `github_connections` or `github_repository_links` rows, so a live connection/import canary has not yet completed.

Hosted runtime flags remain default-off/unaccepted and must not be enabled by Phase 10A1 release alone.

## Remaining release work

1. Prove the new default-off GitHub integration release gate RED, then implement and fully verify it GREEN.
2. Merge Phase 10A1 only with the integration gate still disabled.
3. Verify the six server-only GitHub App settings through a supported provider/configuration surface without exposing values.
4. Verify provider URLs and read-only GitHub App permissions match `PHASE_10A1_GITHUB_APP_SETUP.md`.
5. Perform authenticated Connect GitHub -> installation proof -> repository listing -> repository import acceptance in production.
6. Check browser/persistence/log surfaces for provider-token leakage during the canary.
7. Enable `HOSTED_GITHUB_INTEGRATION_ENABLED=true` only after provider acceptance is green.
8. Keep repository snapshot/scan worker runtime gates disabled until their independent acceptance.
9. Reconcile draft PR #76 onto the released Phase 10A1 baseline and rerun the complete Phase 10A2 matrix.

Detailed release evidence: `docs/development/PHASE_10A1_RELEASE_STATE.md`.