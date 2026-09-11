# ScopeForge Current State

Last reconciled: 2026-09-11 (Asia/Singapore)

## Released baseline

- repository: `LeDoNguyenTu/ScopeForge`
- current released `main`: `1151af2dddb76737ee2f0a0d1a802f06a975d318`
- released `main` includes Phase 10C platform administration
- production deployment: `dpl_AueSXj9wWBDMkRTRLAb6x8nsH57z`
- production deployment state: READY
- production domain: `scopeforge.dev`

The released `main` tree remains authoritative until a later PR is merged and production-verified.

## Released security baseline

Released work includes Phases 1-9E, strict nonce-based CSP, accepted Command Center V5, and Phase 10C platform administration. Preserve together:

- strict nonce CSP with `strict-dynamic`,
- no permanent production `unsafe-inline` or `unsafe-eval`,
- HSTS, nosniff, frame denial, referrer policy and permissions policy,
- authenticated dashboard boundaries,
- workspace RLS/RPC authority separation,
- worker/runtime authority separation,
- accepted V5 desktop/mobile presentation.

## Supabase production truth

ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Phase 10C remains verified. Phase 10A1 production schema is now also freshly reconciled and records:

- `20260910160000_phase_10a1_github_connected_projects`
- `20260910160010_phase_10a1_project_scan_retry_idempotency`
- `20260910160020_phase_10a1_project_scan_waiting_idempotency`
- `20260910160030_phase_10a1_project_scan_recovery`
- `20260911143049_phase_10a1_service_role_table_acl_hardening`

Live verification confirms browser users are SELECT-only on the two public GitHub integration tables, while `service_role` is reduced to `SELECT`, `INSERT`, `UPDATE`, `DELETE`. Privileged Phase 10A1 RPC execution remains service-role-only with pinned `SECURITY DEFINER` search paths.

Security Advisor currently reports no Phase 10A1 release-blocking schema issue. The private project-scan intent table's RLS-with-no-policy INFO is intentional for its service-only private boundary. Supabase leaked-password protection remains disabled and is a separate Auth follow-up.

## Phase 10A1 release candidate

PR #74 (`feat/phase-10a-github-connected-projects`) implements the public GitHub connected-project core.

Latest executable/schema candidate before release-document reconciliation:

`a8959d4b887463b0b28af056932eabd2a75147a3`

CI #907 / run `34610625305`: SUCCESS.

That candidate passed dependency audit, 387 test files / 1,720 tests, typecheck, CLI build/version, both scanner benchmarks, production Next.js build, strict-CSP browser smoke, production V5/Turnstile diagnostic, and artifact upload.

The implementation includes:

- signed GitHub App connection state bound to the ScopeForge user/workspace,
- authenticated GitHub-user proof of installation access,
- ephemeral repository-scoped read-only installation credentials,
- repository picker/import with authoritative server re-fetch,
- verified repository asset/link creation,
- public connected-project snapshot acquisition and exact-snapshot scan continuation,
- recovery for waiting/retry/replay states without implicit reacquisition,
- permanent public/private acquisition separation.

Phase 10A1 is not released yet. The production schema gate is green; the remaining release blocker is the live GitHub App provider canary.

## GitHub provider truth

Required GitHub App/Vercel configuration is documented in `PHASE_10A1_GITHUB_APP_SETUP.md`.

Current conservative state:

- Phase 10A1 production schema: VERIFIED/APPLIED
- Phase 10A1 CI: GREEN
- Phase 10A1 GitHub App environment metadata: NOT DIRECTLY VERIFIABLE through the connected Vercel tool surface
- production GitHub connection rows: 0
- production GitHub repository link rows: 0
- live Connect GitHub provider canary: NOT RUN/NOT VERIFIED

A recent Phase 10A1 Vercel preview is READY and includes the GitHub integration routes. This proves build/deployment health only, not provider credential presence.

## Phase 10A2 stacked implementation

PR #76 (`feat/phase-10a2-private-repository-acquisition`) implements the distinct private-repository acquisition path and remains draft/stacked on Phase 10A1.

Its previously validated exact head `6959cea91cbecba9e9e454901d3c57a95bc46edd` passed CI #904 / run `34607770399` with 392 files / 1,731 tests and the full type/build/benchmark/browser matrix.

Because the Phase 10A1 base branch advanced with production ACL hardening, PR #76 now requires stack reconciliation after Phase 10A1 release. It must not merge ahead of PR #74.

## Runtime truth

Keep these false/absent until independent canary and rollback acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Product implementation or CI success does not authorize hosted worker activation.

## Immediate engineering boundary

1. Complete the Phase 10A1 live GitHub App provider/configuration and authenticated connection/import canary.
2. Run final exact-head PR #74 CI after documentation reconciliation.
3. Merge/release PR #74 only when the provider canary and final head are green.
4. Verify the merged production deployment and security baseline.
5. Reconcile PR #76 onto released Phase 10A1/main and re-run the complete Phase 10A2 validation matrix.
6. Verify/apply Phase 10A2 production migrations and perform the separate private worker provider/runtime canary before Phase 10A2 release.

## Production services

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8` (`scopeforge`)
- production: `scopeforge.dev`
