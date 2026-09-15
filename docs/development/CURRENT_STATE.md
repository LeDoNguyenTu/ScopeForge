# ScopeForge Current State

Last reconciled: 2026-09-13 (Asia/Singapore)

## Released production baseline

- repository: `LeDoNguyenTu/ScopeForge`
- production: `https://scopeforge.dev`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- Vercel team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- ScopeForge Supabase project: `tdgpibrepzcvdivztkta`
- released Phase 10A1 `main`: `33d21de652f3c04aa88ebd4f122348803e59b153`
- Phase 10A1 remains dark-gated behind `HOSTED_GITHUB_INTEGRATION_ENABLED`

The released production tree remains authoritative until later phases are independently accepted, merged and production-verified.

## First blocker - GitHub provider operational acceptance

Tracked in issue #79. This is access-blocked, not approval-blocked.

The connected Vercel surface can inspect project/deployment/log state but cannot read or mutate production environment variables. Do not infer provider configuration and do not expose provider secrets in chat, issues, PR comments, repository files, browser-readable variables or logs.

Required server-only values:

- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_STATE_SECRET`

Independent provider release gate:

- `HOSTED_GITHUB_INTEGRATION_ENABLED`

Required GitHub App configuration remains:

- homepage: `https://scopeforge.dev`
- setup URL: `https://scopeforge.dev/api/integrations/github/callback`
- callback URL: `https://scopeforge.dev/api/integrations/github/callback`
- OAuth during installation: disabled
- Contents: read-only
- Metadata: read-only
- no repository write permissions for Phase 10A1

The owner/admin provider canary must prove installation ownership, repository listing/import, wrong-installation rejection, role authorization, persistence and no credential leakage while all hosted worker flags remain disabled.

## Phase 10A2 - private GitHub repository acquisition

PR #76 remains open and draft.

- branch: `feat/phase-10a2-private-repository-acquisition`
- current head: `709ef8af4ce4befae12ba910d3bca15599b5cab1`
- latest head change is documentation-only branch-cleanup reconciliation

Validated architecture preserves:

- distinct `repository_snapshot_github_private_v1` execution class
- separate default-off private runtime gate
- control-plane-only provider credentials
- attempt-bound private archive capability
- immutable snapshot publication
- exact-snapshot zero-egress continuation
- no public fallback for private acquisition

Static review rechecked the private archive boundary: the control plane binds authoritative repository/commit identity, the worker independently validates the exact codeload host/path/commit, and the snapshot reader independently enforces streamed archive bounds. No additional actionable Phase 10A2 defect was found in that pass.

No Phase 10A2 production migration has been applied and no private runtime flag has been enabled.

## Phase 10A3 - authenticated GitHub webhook reconciliation

PR #77 remains open, draft and stacked on Phase 10A2.

Latest exact executable candidate before documentation-only reconciliation:

- executable head: `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- synthetic merge: `d7322502d3b01e583d0ccf4f4cdadf2cf955bc1b`
- CI #981 / run `34711218370`: SUCCESS
- Node: `v24.20.0`
- npm: `11.19.0`
- audit: 0 vulnerabilities
- Vitest: 415 / 415 files, 1,900 / 1,900 tests
- typecheck: PASS
- CommonJS CLI build/version: PASS, `ScopeForge 0.1.0`
- scanner benchmark: 700 files, 0 errors, 697 ms wall time / 20,000 ms budget
- dependency-lockfile-heavy median: 1,823 ms / 20,000 ms
- IaC-heavy median: 425 ms / 30,000 ms
- source-AST-heavy median: 1,220 ms / 30,000 ms
- optimized Next.js 15.5.24 production build: PASS
- CSP browser acceptance: PASS
- production UI/Turnstile diagnostic: PASS
- visual acceptance artifact: `10303292695`

Documentation-only `[skip ci]` commits after executable head `5f05ed964c8ab43f38a420b1b77317bae630cc1e` do not replace CI #981 as executable-tree evidence. Any later executable change requires fresh exact-candidate validation.

### Completed hardening #78 - bounded webhook streaming

Issue #78 is closed. Unknown-length webhook bodies are streamed under the actual 10 MiB ceiling with cancellation on overflow/read failure. Exact raw bytes remain the HMAC-SHA256 input and signature verification still occurs before JSON parsing.

- RED: CI #958 / run `34681195661`, tests-only head `5de02284a16e79d03c2f275b990ae793a70687f9`
- GREEN: CI #959 / run `34681343582`, implementation head `eb3dc7d35bf334b51b93ebdeb8011277028ae504`

### Completed hardening #80 - same-head pending enqueue recovery

Issue #80 is closed. Migration `20260912024000_phase_10a3_same_head_pending_recovery.sql` prevents `pending=true` with no active scan intent from being stranded by a newer same-head delivery while preserving the exact downstream `latest_delivery_id` stale-enqueue check.

- RED: CI #961 / run `34687272810`, tests-only head `d4582236a45d746c6dba47f6810624b50bd1dd50`
- GREEN: CI #962 / run `34687506721`, implementation head `9c40e89bb9433d8b4ce268302e1a9e5b04f29151`
- migration is reviewed/CI-validated only and remains unapplied to production

### Completed hardening #85 - superseded push authoritative-head recovery

Issue #85 is closed and PR #86 was squash-merged into the Phase 10A3 branch.

A signed default-branch push can arrive after GitHub's current default-branch head has advanced. The old path fetched that newer provider-authoritative head but then returned `AUTHORITATIVE_HEAD_ADVANCED` without advancing the desired-head watermark or enqueueing/coalescing the newly revalidated head. The correction removes only that premature terminal branch.

The signed payload is now a trigger only:

- repository identity/default branch/archive/visibility remain provider-authoritative
- the stale payload SHA is never passed to `recordPushHead` or enqueue
- the freshly fetched GitHub head enters the existing replay/coalescing/runtime-gate machinery
- exact `latest_delivery_id` stale protection remains unchanged
- public/private acquisition-class separation remains unchanged

TDD evidence:

- RED: CI #976 / run `34710448050`, tests-only head `1501b723f394938b8c2af501d50204bcd0db14f0`; all 1,899 pre-existing tests passed and only the new recovery regression failed
- feature GREEN: CI #979 / run `34710886639`, feature head `312495c5e4aef9e5a42d5e06d9e2f2471b0d2ced`, 415 / 415 files and 1,900 / 1,900 tests
- integrated GREEN: CI #981 / run `34711218370` on executable Phase 10A3 head `5f05ed964c8ab43f38a420b1b77317bae630cc1e`

### Completed CI/tooling maintenance

- issue #81 is closed: CI uses `actions/upload-artifact@v7`; the old hosted Node 20 action-runtime warning is gone
- Node runtime alignment is integrated: root engine contract is `>=24 <25`, CI uses Node 24, and the regression guard passes
- Vitest config is now `vitest.config.mts`; the prior CommonJS-loaded ESM warning is gone without converting the CommonJS CLI package to ESM
- architecture audit issue #82 is closed; provider-neutral AI advisory boundaries remain intact, and broader SCM/workspace abstractions are deferred until real requirements justify them

## Phase 10A3 security boundaries

- independent server-only `GITHUB_APP_WEBHOOK_SECRET`
- exact raw-byte HMAC-SHA256 verification before JSON parsing/persistence
- strict delivery/event/content-type validation
- declared and incrementally enforced 10 MiB payload ceiling
- delivery replay protection
- provider-authoritative installation/repository/default-head revalidation
- signed payloads are triggers only, including stale payload heads after #85
- installation/repository lifecycle reconciliation
- latest-head coalescing plus same-head stranded-pending recovery
- exact immutable snapshot completion authority
- public/private acquisition runtime separation
- no raw webhook payload/signature/token/private source persistence

No Phase 10A3 production migration has been applied. No production webhook has been registered and no webhook secret or worker runtime gate has been enabled.

## Runtime truth

Keep these false/absent until independent containment, canary and rollback acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Enabling the GitHub provider integration must not implicitly enable repository snapshot/scan runtimes.

## Independent security/production status

- production password sign-in without a CAPTCHA token was independently rejected with HTTP 400 / `captcha_failed`
- Supabase leaked-password protection remains plan-gated on the current Free organization
- Vercel custom WAF/rate-limit posture remains unverified because the connected surface does not expose authenticated firewall configuration
- fresh production runtime-log checks during Phase 10A3 hardening found no current warning/error/fatal cluster

## Immediate release sequence

1. Resolve #79 through supported authenticated provider/environment-management access.
2. Verify the six server-only GitHub App values and provider-side URL/permission settings without exposing secret values.
3. Enable only `HOSTED_GITHUB_INTEGRATION_ENABLED=true` for the controlled owner/admin provider canary; disable immediately on failure.
4. Keep all hosted worker flags disabled during the provider-only canary.
5. Re-read PR #76 and production migration history, apply only absent reviewed Phase 10A2 migrations, complete dedicated private-worker containment and private archive -> immutable snapshot -> exact zero-egress scan -> findings acceptance, then merge/release PR #76.
6. Reconcile PR #77 onto released Phase 10A2/main and perform fresh exact-candidate validation.
7. Apply only reviewed absent Phase 10A3 migrations, including `20260912024000_phase_10a3_same_head_pending_recovery.sql`, configure the independent webhook secret/endpoint, and run signed-delivery, invalid-signature/oversize, replay, lifecycle, latest-head coalescing, #80 same-head recovery, #85 stale-trigger authoritative-head recovery, leak-check and full automatic-scan canaries.
8. Merge/release PR #77 only after all operational checks pass.

## Resume references

- `docs/development/CURRENT_STATE.md`
- `docs/development/NEXT_STEPS.md`
- `docs/development/PHASE_10A3_WORKING_STATE.md`
- `docs/development/PHASE_10A1_GITHUB_APP_SETUP.md`
- PR #76
- PR #77
- issue #79

Always inspect actual branch heads first. Never skip stack order or infer provider/runtime acceptance from code or CI success alone.
