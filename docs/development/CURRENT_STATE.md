# ScopeForge Current State

Last reconciled: 2026-09-12 (Asia/Singapore)

## Released baseline

- repository: `LeDoNguyenTu/ScopeForge`
- current released `main`: `1151af2dddb76737ee2f0a0d1a802f06a975d318`
- released `main` includes Phase 10C platform administration
- production domain: `scopeforge.dev`

The released `main` tree remains authoritative until a later PR is merged and production-verified.

## Released security baseline

Preserve together throughout later phases:

- strict nonce CSP with `strict-dynamic`,
- no permanent production `unsafe-inline` or `unsafe-eval`,
- HSTS, nosniff, frame denial, referrer and permissions policies,
- authenticated dashboard boundaries,
- workspace RLS/RPC authority separation,
- worker/runtime authority separation,
- accepted Command Center V5 desktop/mobile presentation.

## Phase 10A1 production truth

PR #74 (`feat/phase-10a-github-connected-projects`) implements the public GitHub connected-project core.

Current documentation-reconciled head:

`17831b98dbbf06adf213cd2c8694ecd0d6852b74`

CI #912 / run `34611735763`: SUCCESS.

That exact head passed dependency installation/audit, 387 test files / 1,720 tests, TypeScript, CLI build/version, both scanner benchmarks, production Next.js build, strict-CSP browser smoke, production V5/Turnstile diagnostic and visual artifact upload.

Correct ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Production records all five reviewed Phase 10A1 migrations:

- `20260910160000_phase_10a1_github_connected_projects`
- `20260910160010_phase_10a1_project_scan_retry_idempotency`
- `20260910160020_phase_10a1_project_scan_waiting_idempotency`
- `20260910160030_phase_10a1_project_scan_recovery`
- `20260911143049_phase_10a1_service_role_table_acl_hardening`

Live verification confirms browser users are SELECT-only on the two public GitHub integration tables, while `service_role` is reduced to `SELECT`, `INSERT`, `UPDATE`, `DELETE`. Privileged Phase 10A1 RPC execution remains service-role-only with pinned `SECURITY DEFINER` search paths.

Security Advisor has no Phase 10A1 release-blocking schema issue. The private project-scan intent table's RLS-with-no-policy INFO is intentional for its service-only private boundary. Supabase leaked-password protection remains disabled and is a separate Auth follow-up.

Phase 10A1 is still not released because the live GitHub App provider canary has not been proven. Production currently has zero `github_connections` and zero `github_repository_links` rows. The connected Vercel surface does not expose environment-variable metadata for the six server-only GitHub App settings.

GitHub's exact-head Vercel status currently reports the Hobby build-rate limit. A recent Phase 10A1 branch preview is READY, so this external status is not treated as an application build regression. GitHub CI independently passed the exact head's production build/browser diagnostics.

PR #74 remains draft until the live provider canary is complete.

## Phase 10A2 stacked implementation

PR #76 (`feat/phase-10a2-private-repository-acquisition`) implements private GitHub repository acquisition as a distinct execution class.

Previously validated head:

`6959cea91cbecba9e9e454901d3c57a95bc46edd`

CI #904 / run `34607770399`: SUCCESS with 392 test files / 1,731 tests and the complete type/build/benchmark/browser matrix.

Implemented Phase 10A2 boundaries include:

- distinct `repository_snapshot_github_private_v1` execution class,
- separate default-off `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` gate,
- control-plane-only GitHub App/installation credentials,
- attempt-bound private archive capability rather than provider credentials in the worker contract,
- validated `codeload.github.com` archive acquisition only,
- no repository code/package manager/hook/workflow execution,
- dedicated private executor routing through the shared supervisor,
- strict terminal/repository/default-branch/commit binding,
- private/public visibility changes fail closed,
- no private-to-public acquisition fallback,
- immutable private snapshot publication into the existing exact-snapshot zero-egress repository scan continuation,
- service-role-only privileged Phase 10A2 RPC boundaries.

The Phase 10A1 base advanced after that validation. PR #76 is therefore being stack-reconciled before any new release claim. The reconciliation carries the Phase 10A1 ACL hardening migration/test and the latest Phase 10A1 release documentation into the stack without changing Phase 10A2 runtime behavior. The resulting stack requires a fresh complete CI matrix before it can replace the old validation evidence.

PR #76 remains draft and must not merge before Phase 10A1.

## Runtime truth

Keep these false/absent until independent canary and rollback acceptance authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Product implementation or CI success does not authorize hosted worker activation.

## Immediate engineering boundary

1. Finish stack reconciliation for PR #76 and run the complete current-base validation matrix.
2. Complete the Phase 10A1 live GitHub App provider/configuration and authenticated connection/import canary.
3. Merge/release PR #74 only when the provider canary remains green.
4. Verify the merged production deployment and security baseline.
5. Retarget/reconcile PR #76 onto released `main`, then revalidate if its merge base changes again.
6. Verify/apply only absent Phase 10A2 production migrations and complete the separate private worker/provider/runtime canary before Phase 10A2 release.

## Production services

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8` (`scopeforge`)
- production: `scopeforge.dev`
