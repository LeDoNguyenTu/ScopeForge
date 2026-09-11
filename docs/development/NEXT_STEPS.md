# ScopeForge Next Steps

Last reconciled: 2026-09-12 (Asia/Singapore)

## Released baseline

Current released `main`:

`1151af2dddb76737ee2f0a0d1a802f06a975d318`

Production: `scopeforge.dev`.

Released boundaries include Phases 1-9E, strict CSP, accepted Command Center V5 and Phase 10C platform administration. Do not regress the V5/CSP/auth/RLS/worker-authority baseline while completing later phases.

## Priority 1 - finish Phase 10A1 provider acceptance and release

Active PR: #74
Branch: `feat/phase-10a-github-connected-projects`
Current exact head: `17831b98dbbf06adf213cd2c8694ecd0d6852b74`
CI #912 / run `34611735763`: SUCCESS

Code and production database gates are complete.

Verified production state:

- all five Phase 10A1 migrations are recorded in ScopeForge production,
- browser users are SELECT-only on the public GitHub integration tables,
- `service_role` is reduced to SELECT/INSERT/UPDATE/DELETE on those tables,
- private scan intent has no direct browser/service-role table grant,
- privileged Phase 10A1 RPCs remain service-role-only,
- Security Advisor has no Phase 10A1 release-blocking schema issue,
- exact-head CI #912 passed the complete repository matrix with 1,720 tests.

Remaining release work is provider-focused:

1. Verify the six required GitHub App server-only settings through a supported configuration surface without exposing values.
2. Verify GitHub App homepage, setup URL and callback URL match the documented `https://scopeforge.dev` flow.
3. Verify Contents and Metadata permissions remain read-only with no repository write permission.
4. Run an authenticated owner/admin Connect GitHub -> installation proof -> repository listing -> repository import canary.
5. Confirm no App private key, OAuth token, installation token, signed state or raw provider error body appears in browser state, integration rows, redirects or ordinary logs.
6. Keep hosted worker flags off.
7. Merge PR #74 only after the live provider canary succeeds.
8. Verify the merged production deployment, integration routes, V5/admin/auth paths and security headers.

The exact-head GitHub Vercel status currently reports the Hobby build-rate limit. A recent branch preview is READY and GitHub CI passed the exact head's production build/browser diagnostics, so do not misclassify that external quota condition as a code regression.

## Priority 2 - complete current-base Phase 10A2 stack reconciliation

PR #76 already contains the private repository acquisition implementation and remains draft/stacked on Phase 10A1.

Previously validated head:

`6959cea91cbecba9e9e454901d3c57a95bc46edd`

CI #904 / run `34607770399`: SUCCESS with 392 files / 1,731 tests and the complete validation matrix.

The Phase 10A1 base later advanced by seven commits. The conflict surface is limited to four release/state documents plus the Phase 10A1 ACL hardening migration and regression test.

Current reconciliation sequence:

1. Carry the verified Phase 10A1 ACL migration and regression test into the stack unchanged.
2. Sync the Phase 10A1 release/working-state documents from the verified base.
3. Reconcile shared `CURRENT_STATE.md` and `NEXT_STEPS.md` so Phase 10A1 production truth and Phase 10A2 implementation truth both remain explicit.
4. Confirm GitHub can synthesize a merge candidate against the latest Phase 10A1 base.
5. Run the complete Phase 10A2 validation matrix against that current base.
6. Keep PR #76 draft/non-releasable even if CI passes because Phase 10A1 has not released yet.

## Priority 3 - Phase 10A2 production schema/provider/private canary

After Phase 10A1 releases and PR #76 is reconciled onto released `main`:

1. Read the exact ScopeForge production migration head.
2. Apply only reviewed forward Phase 10A2 migrations that are absent.
3. Verify private tables/RPCs, explicit revokes/grants, RLS and service-role authority boundaries.
4. Run Security Advisor.
5. Verify GitHub App access to a selected private test repository with intended read-only permissions.
6. Verify the dedicated private snapshot worker deployment and rollback mechanism.
7. Enable `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` only in the accepted canary environment.
8. Run one complete private connected-project canary: project scan request -> private archive lease -> immutable snapshot publication -> exact zero-egress repository scan -> findings.
9. Verify provider credentials never reach the worker contract and archive capability/private source do not appear in browser state or ordinary logs.
10. Disable the flag immediately if identity, credential, network, publication, containment or cleanup invariants fail.
11. Merge/release Phase 10A2 only after every code, schema, provider and runtime gate is green.

## Priority 4 - independent hosted runtime acceptance

Keep these false/absent until independent operational canary and rollback acceptance explicitly authorizes each capability:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

A canary must prove the exact worker class, containment, quotas, cancellation/recovery, observability and rollback path before its flag changes in production.

## Remaining provider/security follow-ups

- Supabase leaked-password protection remains disabled; enable only through a supported Auth-management surface and re-verify auth flows.
- Verify Turnstile production enforcement rather than inferring it from configuration code.
- Verify Vercel WAF/rate-limit controls through a supported management surface.
- Preserve strict nonce CSP and existing browser security headers during all provider changes.
- Deployment discovery/DAST remains a later connected-project phase after private repository acquisition is stable.

## Baseline rule

Any next implementation work must preserve together:

- accepted Command Center V5 desktop/mobile presentation,
- Phase 10C admin console and authority separation,
- strict nonce CSP,
- Supabase workspace/RLS/RPC authorization,
- no browser service-role/provider secrets,
- no GitHub provider credentials in worker contracts,
- public/private repository acquisition class separation,
- worker/runtime authority separation,
- disabled/unaccepted hosted capability defaults,
- immutable snapshot and finding provenance,
- exact-snapshot recovery without implicit reacquisition.
