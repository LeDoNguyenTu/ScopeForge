# ScopeForge Current State

Last reconciled: 2026-09-12 (Asia/Singapore)

## Released production baseline

- repository: `LeDoNguyenTu/ScopeForge`
- production: `https://scopeforge.dev`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- Vercel team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- ScopeForge Supabase project: `tdgpibrepzcvdivztkta`
- released Phase 10A1 `main`: `33d21de652f3c04aa88ebd4f122348803e59b153`
- Phase 10A1 GitHub connected-projects code is released with `HOSTED_GITHUB_INTEGRATION_ENABLED` disabled/missing until operational provider acceptance
- production connect/callback probes previously confirmed the disabled path and secure transient-cookie clearing
- fresh production fetches remain HTTP 200 with the expected strict nonce CSP and released ScopeForge UI
- fresh Vercel runtime-error inspection after the latest hardening found no production runtime-error cluster in the last hour

The released production tree remains authoritative until later phases are independently accepted, merged and production-verified.

## Phase 10A1 - provider acceptance is the first blocker

PR #74 is already merged and deployed. The remaining Phase 10A1 work is operational GitHub App acceptance, not application implementation.

Tracked blocker: issue #79.

Current connected tooling can inspect Vercel projects, deployments and logs but cannot read or mutate production environment variables. Do not infer provider configuration and do not expose secrets in chat, GitHub issues, PR comments, repository files, browser-readable variables, or logs.

Required server-only GitHub App values:

- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_STATE_SECRET`

Independent release gate:

- `HOSTED_GITHUB_INTEGRATION_ENABLED`

Required provider configuration remains:

- homepage: `https://scopeforge.dev`
- setup URL: `https://scopeforge.dev/api/integrations/github/callback`
- callback URL: `https://scopeforge.dev/api/integrations/github/callback`
- OAuth during installation: disabled
- Contents: read-only
- Metadata: read-only
- no repository write permissions for Phase 10A1

The controlled owner/admin canary must prove installation ownership, repository listing/import, wrong-installation rejection, role authorization, persistence and no credential leakage. Keep the release gate false if any check fails.

## Phase 10A2 - private GitHub repository acquisition

PR #76 is open, draft and must remain unreleased until the Phase 10A1 provider canary passes.

Current branch:

`feat/phase-10a2-private-repository-acquisition`

Current head:

`709ef8af4ce4befae12ba910d3bca15599b5cab1`

The latest head change is documentation-only branch-cleanup reconciliation. Previously validated Phase 10A2 implementation preserves:

- distinct `repository_snapshot_github_private_v1` execution class
- separate default-off private runtime gate
- control-plane-only provider credentials
- attempt-bound private archive capability
- immutable snapshot publication
- exact-snapshot zero-egress continuation
- no public fallback for private acquisition

A fresh static review in this continuation rechecked the private archive boundary. The control plane binds authoritative repository and commit identity, the worker independently validates the exact codeload host/path/commit, and the snapshot parser independently enforces streamed archive bounds. No additional actionable Phase 10A2 defect was identified in that review pass.

No Phase 10A2 production migration has been applied and no private runtime flag has been enabled.

## Phase 10A3 - authenticated GitHub webhook reconciliation

PR #77 is open, draft and stacked on Phase 10A2.

Current branch:

`feat/phase-10a3-github-webhook-reconciliation`

Latest executable implementation candidate:

`eb3dc7d35bf334b51b93ebdeb8011277028ae504`

Issue #78 bounded-stream hardening is completed and closed.

### Verified bounded-body correction

Static review found that unknown-length webhook bodies previously used `request.arrayBuffer()`, so an oversized chunked body could be fully buffered before the application-level 10 MiB actual-body check rejected it.

RED evidence:

- tests-only head: `5de02284a16e79d03c2f275b990ae793a70687f9`
- CI #958 / run `34681195661`
- 411 files / 1,895 tests executed
- exactly the new bounded-stream regression failed because the old reader consumed beyond the overflow boundary

GREEN evidence:

- implementation head: `eb3dc7d35bf334b51b93ebdeb8011277028ae504`
- synthetic merge against the current Phase 10A2 base: `4b5d2d287f6d747c69c769a70d63e1671f4ad3a2`
- CI #959 / run `34681343582`: SUCCESS
- `npm audit --audit-level=info`: 0 vulnerabilities
- Vitest: 411 / 411 files, 1,895 / 1,895 tests
- webhook trust-boundary suite: 13 / 13 tests
- typecheck: PASS
- CLI build/version: PASS, `ScopeForge 0.1.0`
- scanner benchmark: PASS, 700 files, zero errors, 880 ms wall time against 20,000 ms budget
- dependency-lockfile / IaC / source-AST benchmark matrix: PASS
- optimized Next.js production build: PASS
- strict CSP browser smoke: PASS
- production ScopeForge/Turnstile diagnostic: PASS
- visual acceptance artifact: `10293699844`

The reader now consumes the request stream incrementally, rejects as soon as accumulated bytes exceed 10 MiB, attempts cancellation on overflow/read failure, and only assembles accepted bytes after the bounded read. Exact raw-byte HMAC-SHA256 verification still occurs before JSON parsing. Existing 400/401/413 semantics remain intact.

Documentation-only commits after executable head `eb3dc7d35bf334b51b93ebdeb8011277028ae504` do not replace CI #959 as executable-tree validation. Any later executable change requires fresh validation.

### Existing Phase 10A3 boundaries

- independent server-only `GITHUB_APP_WEBHOOK_SECRET`
- exact raw-byte HMAC-SHA256 verification before JSON parsing/persistence
- strict delivery/event/content-type validation
- incrementally enforced declared/actual 10 MiB payload ceiling
- delivery replay protection
- provider-authoritative installation/repository/default-head revalidation
- lifecycle reconciliation for installation and repository-access changes
- latest-head coalescing
- exact immutable snapshot completion authority
- public/private acquisition runtime separation
- no raw webhook payload/signature/token/private source persistence

No Phase 10A3 migration has been applied to production. No production webhook has been registered. No webhook secret or worker runtime gate has been enabled.

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

The connected GitHub write surface still has no genuine delete-ref operation. Do not simulate branch deletion by force-moving stale refs.

## Independent security status

### Turnstile

Production password-sign-in server enforcement was independently verified by a no-token password request returning HTTP 400 / `captcha_failed`. This does not claim successful challenge acceptance on every Auth endpoint.

### Supabase leaked-password protection

The ScopeForge organization is on the Free plan and leaked-password protection remains plan-gated. Do not change unrelated auth/database behavior merely to silence the advisor warning.

### Vercel WAF / rate limiting

The current connected surface does not expose live custom firewall/rate-limit configuration. Treat custom WAF posture as unverified until authenticated configuration access is available. Do not infer custom rules from Vercel platform defaults.

## Immediate release sequence

1. Resolve issue #79 with supported authenticated provider/environment-management access.
2. Verify the six server-only GitHub App settings and provider-side URL/permission configuration without exposing secret values.
3. Deliberately enable only `HOSTED_GITHUB_INTEGRATION_ENABLED=true` for the controlled owner/admin connection/import canary. Disable immediately on failure.
4. Keep all hosted worker flags disabled while performing the provider-only canary.
5. Re-read PR #76 head and production migration history, apply only absent reviewed Phase 10A2 migrations, complete dedicated private-worker containment and private archive -> immutable snapshot -> exact zero-egress scan -> findings acceptance, then merge/release PR #76.
6. Reconcile PR #77 onto released Phase 10A2/main and perform fresh exact-candidate validation.
7. Apply reviewed Phase 10A3 migrations, configure the independent webhook secret/endpoint, and run signed-delivery, oversized/invalid-signature, replay, lifecycle, coalescing, leak-check and end-to-end automatic-scan canaries.
8. Merge/release PR #77 only after all operational checks pass.

Never skip stack order or infer provider/runtime acceptance from CI success alone.
