# Phase 10A1 GitHub Connected Projects Working State

Last reconciled: 2026-09-11 (Asia/Singapore)
Branch: `feat/phase-10a-github-connected-projects`
PR: #74
Status: implementation complete and exact-head code validation green; production database/provider activation still gated

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
- Project-level read model exposes only safe state (`idle`, `snapshot_queued`, `waiting_scan_runtime`, `scan_queued`, `retry_pending`).
- Hosted snapshot/scan capability gates remain independently fail-closed.

## Recovery hardening completed

Release review found a liveness/correctness defect after snapshot publication: `waiting_scan_runtime` and `retry_pending` had no safe resume action. The generic repository-scan enqueue function also chooses the newest eligible snapshot, so delayed continuation could create work for a newer snapshot before detecting mismatch.

The branch now includes:

- `get_connected_project_scan_recovery` service-role RPC with owner/admin authorization,
- `enqueue_repository_scan_worker_task_for_snapshot` exact-snapshot RPC,
- replacement connected-project continuation that binds scan creation to `target_snapshot_id` before any job/task side effect,
- `resumeConnectedProjectScan()` with fresh GitHub revalidation,
- bounded server action and `Resume project scan` UI for waiting/retry states,
- fail-closed behavior while scan runtime is disabled,
- no implicit second snapshot during recovery,
- idempotent replay for an already queued scan.

## TDD / validation history

The environment cannot clone GitHub directly, so implementation used GitHub branches and CI for executable proof.

Relevant checkpoints:

- Tasks 1-3 candidate `f4020265f4d884588147f8f278370f1c4e2d35ab`: complete CI success.
- Task 4 candidate `8cd1983b5b9d54fc2300bd1f27c288ef2f268793`: complete CI success.
- Connected-project UI candidate before recovery review: complete CI success with 1,710 tests.
- Recovery RED checkpoint `b776ab78b61b490be04a8121bb07958d36ed19f2`: 1,711 existing tests passed and exactly eight new recovery assertions failed as intended.
- Recovery GREEN candidate `005504387cf29d65d6b297acb041b608f0416c1a`: CI #852 / run `34520609482` SUCCESS.

CI #852 passed:

- dependency audit: 0 reported vulnerabilities,
- 386 test files / 1,719 tests,
- TypeScript,
- CLI build/version,
- scanner benchmark,
- benchmark matrix,
- Next.js production build,
- CSP browser smoke,
- production V5/Turnstile diagnostic,
- visual artifact upload.

GitHub CI validates the PR merge result against current `main`, which is `1151af2dddb76737ee2f0a0d1a802f06a975d318` and already includes Phase 10C.

## Production truth

Current released `main`: `1151af2dddb76737ee2f0a0d1a802f06a975d318`
Current production Vercel deployment: `dpl_AueSXj9wWBDMkRTRLAb6x8nsH57z`, READY, aliased to `scopeforge.dev`.

Phase 10C production database state was previously verified and is documented in `PHASE_10C_WORKING_STATE.md`.

Phase 10A1 production database migration was **not performed in the current validation session**. A fresh Supabase migration-head read was attempted after code validation, but the connected Supabase database action became unavailable. No schema write was attempted after that failure.

Live GitHub App/Vercel server-only environment configuration is also not freshly verifiable through the present Vercel tool surface. Therefore Connect GitHub is not claimed as production-active yet.

Vercel produced READY previews for multiple Phase 10A1 intermediate commits. The final candidate's GitHub Vercel status currently reports the Hobby-plan build-rate limit; GitHub CI independently passed the exact candidate's production build and browser gates.

Hosted runtime flags remain default-off/unaccepted and must not be enabled by this phase alone.

## Remaining release work

1. Restore a supported Supabase production management surface and inspect the fresh migration head.
2. Apply/reconcile the four reviewed Phase 10A1 migrations in order; verify targeted schema/RPC behavior and Security Advisor.
3. Verify live GitHub App provider configuration and callback/repository import without exposing secrets.
4. Keep snapshot/scan/passive/CORS hosted runtime flags off until their independent canary/rollback acceptance succeeds.
5. Re-run exact-head CI after any executable or migration change.
6. Merge PR #74 only once schema/provider state is safe.
7. After safe Phase 10A1 release, begin Phase 10A2 private repository acquisition as a separate execution class.

Detailed release evidence: `docs/development/PHASE_10A1_RELEASE_STATE.md`.
