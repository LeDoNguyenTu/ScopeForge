# Phase 10A1 GitHub Connected Projects Working State

Last reconciled: 2026-09-11 (Asia/Singapore)
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

Security Advisor has no Phase 10A1 release-blocking schema finding. The private intent table's no-policy INFO is intentional for the private service-only boundary. The existing leaked-password-protection WARN remains a separate Auth follow-up.

## TDD / validation history

- Recovery RED checkpoint `b776ab78b61b490be04a8121bb07958d36ed19f2`: 1,711 existing tests passed and exactly eight new recovery assertions failed.
- Recovery GREEN candidate `005504387cf29d65d6b297acb041b608f0416c1a`: CI #852 / run `34520609482` SUCCESS.
- ACL-hardening RED checkpoint `e5ffd6a8e640483adec01d1856878f78f4114c83`: all 1,719 existing tests passed and exactly the new migration-presence assertion failed.
- ACL-hardening GREEN candidate `a8959d4b887463b0b28af056932eabd2a75147a3`: CI #907 / run `34610625305` SUCCESS.

CI #907 passed:

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

The connected Vercel surface in this session does not expose environment-variable metadata, so configuration presence cannot be asserted from tooling. A READY Phase 10A1 preview proves the app builds with the integration routes, but configuration is evaluated inside the authenticated owner/admin flow and therefore needs a real provider acceptance.

Production currently has no `github_connections` or `github_repository_links` rows, so a live connection/import canary has not yet completed.

Hosted runtime flags remain default-off/unaccepted and must not be enabled by Phase 10A1 release alone.

## Remaining release work

1. Verify the six server-only GitHub App settings through a supported provider/configuration surface without exposing values.
2. Verify provider URLs and read-only GitHub App permissions match `PHASE_10A1_GITHUB_APP_SETUP.md`.
3. Perform authenticated Connect GitHub -> installation proof -> repository listing -> repository import acceptance.
4. Check browser/persistence/log surfaces for provider-token leakage during the canary.
5. Run final exact-head CI after release-document reconciliation.
6. Merge PR #74 only after provider acceptance remains green.
7. Verify the merged production deployment and security baseline.
8. Reconcile draft PR #76 onto the released Phase 10A1 baseline and rerun the complete Phase 10A2 matrix.

Detailed release evidence: `docs/development/PHASE_10A1_RELEASE_STATE.md`.
