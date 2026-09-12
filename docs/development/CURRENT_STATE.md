# ScopeForge Current State

Last reconciled: 2026-09-12 (Asia/Singapore)

## Released production baseline

- repository: `LeDoNguyenTu/ScopeForge`
- production: `https://scopeforge.dev`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- Vercel team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- ScopeForge Supabase project: `tdgpibrepzcvdivztkta`
- released Phase 10A1 `main`: `33d21de652f3c04aa88ebd4f122348803e59b153`
- Phase 10A1 GitHub connected-projects code is released dark-gated behind `HOSTED_GITHUB_INTEGRATION_ENABLED`
- production connect/callback probes confirmed the disabled path
- recent production runtime inspection found no current runtime-error cluster

The released production tree remains authoritative until later phases are independently accepted, merged and production-verified.

## First blocker - GitHub provider operational acceptance

Tracked in issue #79. This is access-blocked, not approval-blocked.

The connected Vercel surface can inspect projects, deployments and logs but cannot read or mutate production environment variables. Do not infer provider configuration and do not expose provider secrets in chat, issues, PR comments, repository files, browser-readable variables or logs.

Required server-only values:

- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_STATE_SECRET`

Independent release gate:

- `HOSTED_GITHUB_INTEGRATION_ENABLED`

Provider configuration remains:

- homepage: `https://scopeforge.dev`
- setup/callback: `https://scopeforge.dev/api/integrations/github/callback`
- OAuth during installation: disabled
- Contents: read-only
- Metadata: read-only
- no repository write permissions for Phase 10A1

The controlled owner/admin canary must prove installation ownership, repository listing/import, wrong-installation rejection, role authorization, persistence and no credential leakage. Keep the gate false if any check fails.

## Phase 10A2 - private GitHub repository acquisition

PR #76 remains open and draft.

- branch: `feat/phase-10a2-private-repository-acquisition`
- current head: `709ef8af4ce4befae12ba910d3bca15599b5cab1`
- latest head change is documentation-only branch-cleanup reconciliation

Validated implementation preserves:

- distinct `repository_snapshot_github_private_v1` execution class
- separate default-off private runtime gate
- control-plane-only provider credentials
- attempt-bound private archive capability
- immutable snapshot publication
- exact-snapshot zero-egress continuation
- no public fallback for private acquisition

A fresh static review rechecked the private archive boundary. The control plane binds authoritative repository/commit identity, the worker independently validates the exact codeload host/path/commit, and the snapshot parser independently enforces streamed archive bounds. No additional actionable Phase 10A2 defect was identified in that pass.

No Phase 10A2 production migration has been applied and no private runtime flag has been enabled.

## Phase 10A3 - authenticated GitHub webhook reconciliation

PR #77 remains open, draft and stacked on Phase 10A2.

- branch: `feat/phase-10a3-github-webhook-reconciliation`
- latest verified executable head: `9c40e89bb9433d8b4ce268302e1a9e5b04f29151`
- exact validation synthetic merge: `333711dfa8490fc137999dfb98d25ad9f248c5bd`
- CI #962 / run `34687506721`: SUCCESS
- audit: 0 vulnerabilities
- Vitest: 412 / 412 files, 1,896 / 1,896 tests
- typecheck: PASS
- CLI build/version: PASS, `ScopeForge 0.1.0`
- scanner benchmark: PASS, 700 files, zero errors, 622 ms wall time against 20,000 ms budget
- dependency, IaC and source-AST benchmark matrix: PASS
- optimized production build: PASS
- strict CSP browser acceptance: PASS
- production ScopeForge/Turnstile diagnostic: PASS
- visual acceptance artifact: `10296117940`

### Completed hardening #78 - bounded webhook streaming

Issue #78 is closed. Unknown-length webhook bodies are read incrementally instead of using an unbounded `request.arrayBuffer()` path. The reader rejects after the 10 MiB ceiling is crossed, cancels on overflow/read failure, preserves accepted raw bytes, and still performs exact HMAC-SHA256 verification before JSON parsing.

RED: CI #958 / run `34681195661`, tests-only head `5de02284a16e79d03c2f275b990ae793a70687f9`.

GREEN: CI #959 / run `34681343582`, implementation head `eb3dc7d35bf334b51b93ebdeb8011277028ae504`.

### Completed hardening #80 - same-head pending enqueue recovery

Issue #80 is closed.

Static concurrency review found a no-lost-head race between `record_github_webhook_push_head` and `enqueue_github_webhook_project_snapshot`: a newer same-head delivery could advance `latest_delivery_id`, the older enqueue would correctly fail stale, but the newer delivery could be classified as a semantic replay solely because `pending=true`, even when no active intent owned the queue chain. That could leave `pending=true` with no task and no guaranteed recovery trigger.

Forward-only migration:

`20260912024000_phase_10a3_same_head_pending_recovery.sql`

The replacement RPC preserves the existing per-link advisory lock and stale enqueue validation. It locks the current intent before same-head replay classification:

- same desired SHA + pending + active intent -> semantic replay/coalescing remains unchanged
- same desired SHA + pending + no active intent -> newest delivery returns `shouldEnqueue=true` and can restore the queue chain
- racing older delivery still fails the downstream exact `latest_delivery_id` stale check

RED evidence:

- tests-only head: `d4582236a45d746c6dba47f6810624b50bd1dd50`
- CI #961 / run `34687272810`
- synthetic merge: `e4776ec80b841c5908fe6855c495dae3f9ccb554`
- audit: 0 vulnerabilities
- 411 / 412 test files and 1,895 / 1,896 tests passed
- the only failure was the new missing-recovery-overlay regression

GREEN evidence is the current executable candidate and CI #962 recorded above.

### Existing Phase 10A3 security boundaries

- independent server-only `GITHUB_APP_WEBHOOK_SECRET`
- exact raw-byte HMAC-SHA256 verification before JSON parsing/persistence
- strict delivery/event/content-type validation
- incrementally enforced declared/actual 10 MiB payload ceiling
- delivery replay protection
- provider-authoritative installation/repository/default-head revalidation
- lifecycle reconciliation for installation/repository access changes
- latest-head coalescing with same-head stranded-pending recovery
- exact immutable snapshot completion authority
- public/private acquisition runtime separation
- no raw webhook payload/signature/token/private source persistence

No Phase 10A3 production migration has been applied. The new `20260912024000` migration is code-reviewed/CI-validated only and must remain unapplied until the Phase 10A3 release gate. No production webhook has been registered and no webhook secret or worker runtime gate has been enabled.

## Runtime truth

Keep these false/absent until independent containment, canary and rollback acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Enabling the GitHub provider integration must not implicitly enable repository snapshot/scan runtimes.

## Repository hygiene

`docs/development/BRANCH_CLEANUP_CANDIDATES.md` is refreshed on PR #76.

Retain:

- `main`
- `feat/phase-10a2-private-repository-acquisition`
- `feat/phase-10a3-github-webhook-reconciliation`
- `demo/portfolio-20260910`

The connected GitHub surface still has no genuine delete-ref operation. Do not simulate branch deletion by force-moving stale refs.

## Independent security status

- Production password-sign-in server enforcement was independently verified by a no-token request returning HTTP 400 / `captcha_failed`.
- Supabase leaked-password protection remains plan-gated on the current Free organization.
- Vercel custom WAF/rate-limit posture remains unverified because the current connected surface does not expose authenticated firewall configuration.
- CI still emits a non-blocking Vite future-config warning because `vitest.config.ts` uses ESM syntax while the package is CommonJS by default.
- CI also emits a non-blocking Node-runtime deprecation warning from `actions/upload-artifact@v4`. These maintenance warnings are separate from Phase 10A2/10A3 release acceptance.

## Immediate release sequence

1. Resolve #79 with supported authenticated provider/environment-management access.
2. Verify the six server-only GitHub App settings and provider-side URL/permission configuration without exposing secret values.
3. Enable only `HOSTED_GITHUB_INTEGRATION_ENABLED=true` for the controlled owner/admin provider canary. Disable immediately on failure.
4. Keep all hosted worker flags disabled during the provider-only canary.
5. Re-read PR #76 and production migration history, apply only absent reviewed Phase 10A2 migrations, complete dedicated private-worker containment and private archive -> immutable snapshot -> exact zero-egress scan -> findings acceptance, then merge/release PR #76.
6. Reconcile PR #77 onto released Phase 10A2/main and perform fresh exact-candidate validation.
7. Apply only the reviewed absent Phase 10A3 migrations, including `20260912024000_phase_10a3_same_head_pending_recovery.sql`, configure the independent webhook secret/endpoint, and run signed-delivery, oversized/invalid-signature, replay, lifecycle, coalescing, same-head race recovery, leak-check and end-to-end automatic-scan canaries.
8. Merge/release PR #77 only after all operational checks pass.

Never skip stack order or infer provider/runtime acceptance from CI success alone.
