# ScopeForge Next Steps

Last reconciled: 2026-09-11 (Asia/Singapore)

## Released baseline

Current released `main`:

`1151af2dddb76737ee2f0a0d1a802f06a975d318`

Current production deployment:

`dpl_AueSXj9wWBDMkRTRLAb6x8nsH57z` - READY on `scopeforge.dev`

Released boundaries include Phases 1-9E, strict CSP, accepted Command Center V5, and Phase 10C platform administration. Do not regress the V5/CSP/auth/RLS/worker-authority baseline while completing later phases.

## Priority 1 - finish Phase 10A1 provider acceptance and release

Active PR: #74
Branch: `feat/phase-10a-github-connected-projects`
Latest executable/schema candidate before documentation reconciliation: `a8959d4b887463b0b28af056932eabd2a75147a3`
CI #907 / run `34610625305`: SUCCESS

Code and production database gates are complete.

Verified production state:

- all five Phase 10A1 migrations are recorded in ScopeForge production,
- browser users are SELECT-only on the public GitHub integration tables,
- `service_role` is reduced to application-required SELECT/INSERT/UPDATE/DELETE privileges,
- private scan intent has no direct browser/service-role table grant,
- privileged Phase 10A1 RPCs remain service-role-only,
- Security Advisor has no Phase 10A1 release-blocking schema issue,
- CI #907 passed 387 files / 1,720 tests plus typecheck, CLI, benchmarks, build and browser diagnostics.

Remaining release work is now narrowly provider-focused:

1. Verify the six required GitHub App server-only settings through a supported provider/configuration surface without exposing values.
2. Verify GitHub App homepage, setup URL and callback URL point to `https://scopeforge.dev` and the documented callback path.
3. Verify GitHub App repository permissions remain Contents read-only and Metadata read-only, with no write permission.
4. Run an authenticated owner/admin Connect GitHub -> installation proof -> repository listing -> repository import canary.
5. Confirm no GitHub App private key, OAuth token, installation token, signed state or provider error body appears in browser state, integration rows, redirects or ordinary logs.
6. Keep hosted worker flags off.
7. Run final exact-head CI after release-document reconciliation.
8. Merge PR #74 only after the live provider canary succeeds and the final head remains green.
9. Verify the merged production deployment, integration routes, V5/admin/auth paths and security headers.

The connected Vercel surface in the current session does not expose environment-variable metadata, and production currently has zero GitHub connection/repository-link rows. Do not replace the live provider canary with inference from a READY preview.

Detailed evidence: `docs/development/PHASE_10A1_RELEASE_STATE.md`.

## Priority 2 - reconcile and release Phase 10A2

PR #76 already contains the private repository acquisition implementation and remains draft/stacked on Phase 10A1.

Previously validated exact head:

`6959cea91cbecba9e9e454901d3c57a95bc46edd`

CI #904 / run `34607770399`: SUCCESS with 392 files / 1,731 tests and the complete validation matrix.

After Phase 10A1 safely releases:

1. Reconcile/retarget PR #76 onto the released Phase 10A1/main baseline. Do not force-merge the currently stale stack.
2. Review the stack reconciliation for migration ordering, GitHub provider boundaries and public/private execution-class isolation.
3. Re-run the complete Phase 10A2 exact-head matrix after reconciliation.
4. Read the fresh production migration head and apply only absent reviewed Phase 10A2 forward migrations.
5. Verify private tables/RPCs, revokes/grants, RLS and Security Advisor.
6. Verify GitHub App access to a selected private test repository with the intended read-only permissions.
7. Verify the dedicated private snapshot worker deployment and rollback mechanism.
8. Enable `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` only in the accepted canary environment.
9. Run one complete private connected-project canary: project scan request -> private archive lease -> immutable snapshot publication -> exact zero-egress repository scan -> findings.
10. Verify provider credentials never reach the worker contract and archive capability/private source do not appear in browser state or ordinary logs.
11. Merge/release Phase 10A2 only after every code, schema, provider and runtime gate is green.

## Priority 3 - independent hosted runtime acceptance

Keep these false/absent until independent operational canary and rollback acceptance explicitly authorizes each capability:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

A canary must prove the exact worker class, containment, quotas, cancellation/recovery, observability and rollback path before its flag changes in production.

## Priority 4 - remaining provider/security follow-ups

- Supabase leaked-password protection remains disabled; enable only through a supported Auth-management surface and re-verify auth flows.
- Verify Turnstile production enforcement rather than inferring it from configuration code.
- Verify any Vercel WAF/rate-limit controls through a supported management surface.
- Preserve strict nonce CSP and existing browser security headers during all provider changes.
- Deployment discovery/DAST remains a later connected-project phase after private repository acquisition is stable.

## Branch cleanup

Historical completed diagnostic/preview/reconciliation branches remain. Delete them only when a genuine safe delete-ref operation is available. Never simulate deletion by moving stale refs to `main`.

## Baseline rule

Any next implementation work must preserve together:

- accepted Command Center V5 desktop/mobile presentation,
- Phase 10C admin console and authority separation,
- strict nonce CSP,
- Supabase workspace/RLS/RPC authorization,
- no browser service-role/provider secrets,
- public/private repository acquisition class separation,
- worker/runtime authority separation,
- disabled/unaccepted hosted capability defaults,
- immutable snapshot and finding provenance,
- exact-snapshot recovery without implicit reacquisition.
