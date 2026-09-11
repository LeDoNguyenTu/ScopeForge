# ScopeForge Next Steps

Last reconciled: 2026-09-11 (Asia/Singapore)

## Released baseline

Current released `main`:

`1151af2dddb76737ee2f0a0d1a802f06a975d318`

Current production deployment:

`dpl_AueSXj9wWBDMkRTRLAb6x8nsH57z` - READY on `scopeforge.dev`

Released boundaries include Phases 1-9E, strict CSP, accepted Command Center V5, and Phase 10C platform administration.

Do not regress the V5/CSP/auth/RLS/worker-authority baseline while completing later phases.

## Priority 1 - finish exact-head Phase 10A2 validation

Active PR: #76

Branch: `feat/phase-10a2-private-repository-acquisition`

Phase 10A2 private repository acquisition is implemented through the project-level routing, worker acquisition/publication and exact-snapshot repository scan continuation path. Permanent architecture guards and working-state documentation are present.

Before treating the current implementation as green:

1. Trigger fresh CI against the exact candidate head.
2. Require `npm audit --audit-level=info` to pass at the repository-defined threshold.
3. Require the full Vitest suite to pass, including Phase 10A2 service, action, component, persistence and architecture guards.
4. Require `npm run typecheck` to pass.
5. Require CLI build/version execution to pass.
6. Require scanner and matrix benchmarks to pass their repository thresholds.
7. Require the production Next.js build to pass with the repository's CI fixture environment.
8. Require CSP browser smoke and production diagnostic checks to pass or identify an external quota/provider blocker explicitly.
9. Review every PR #76 changed file for credential leakage, archive-capability logging, arbitrary egress, public-class widening, cross-workspace/task confusion, expiry/retry bypass, RPC ACL regression and runtime-gate bypass.
10. Any executable correction restarts focused TDD and invalidates prior candidate evidence.

Detailed state: `docs/development/PHASE_10A2_WORKING_STATE.md`.

## Priority 2 - safely release Phase 10A1 and reconcile the stack

PR #74 remains the Phase 10A1 public connected-project release boundary.

Its previously validated executable candidate passed CI #852 / run `34520609482`, but release still requires the production provider/schema gates recorded in `PHASE_10A1_RELEASE_STATE.md`.

Required sequence:

1. Restore a supported Supabase production management surface.
2. Read the fresh ScopeForge migration head. Never substitute the Job Command Center project.
3. Apply/reconcile the reviewed Phase 10A1 migrations only when absent.
4. Verify tables/RPCs, browser grants/RLS, exact-snapshot recovery functions and function ACLs.
5. Run Supabase Security Advisor and resolve any Phase 10A1-introduced finding.
6. Verify required GitHub App server-only provider configuration without exposing secret values.
7. Perform live Connect GitHub -> installation proof -> repository list -> repository import acceptance when provider configuration is available.
8. Merge PR #74 only when its production safety conditions are satisfied.
9. Verify the merged production deployment and existing V5/admin/auth/security-header paths.
10. Retarget/rebase/reconcile PR #76 onto the released Phase 10A1/main state.
11. Re-run the complete Phase 10A2 validation matrix after that reconciliation.

## Priority 3 - Phase 10A2 production schema/provider/private canary

Do not enable the private acquisition runtime merely because the code is merged or CI is green.

After Phase 10A1 stack reconciliation:

1. Read the exact production Supabase migration head.
2. Apply only the reviewed forward Phase 10A2 migrations that are absent.
3. Verify private tables, RPC definitions, explicit revokes/grants, RLS and service-role authority boundaries.
4. Run Security Advisor.
5. Verify GitHub App access to a selected private test repository with the intended read-only permissions.
6. Verify the dedicated private snapshot worker deployment and rollback mechanism.
7. Enable `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` only in the accepted canary environment.
8. Run one complete private connected-project canary: project scan request -> private archive lease -> immutable snapshot publication -> exact zero-egress repository scan -> findings.
9. Verify repository provider credentials never reach the worker contract and archive capability/private source do not appear in browser state or ordinary logs.
10. Disable the flag immediately if identity, credential, network, publication, containment or cleanup invariants fail.
11. Merge/release Phase 10A2 only after the exact production deployment is verified.

## Priority 4 - independent hosted runtime acceptance

Phase 10A product releases do not automatically authorize dormant worker activation.

Keep these false/absent until independent operational canary and rollback acceptance explicitly authorizes each capability:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

A canary must prove the exact worker class, containment, quotas, cancellation/recovery, observability, and rollback path before its flag changes in production.

## Priority 5 - remaining provider/security follow-ups

- Supabase leaked-password protection was last verified disabled; enable only through a supported Auth-management surface and re-verify auth flows.
- Verify Turnstile production enforcement rather than inferring it from configuration code.
- Verify any Vercel WAF/rate-limit controls through a supported management surface.
- Preserve strict nonce CSP and existing browser security headers during all provider changes.
- Continue deployment discovery/DAST as a later connected-project phase only after private repository acquisition is stable and released.

## Branch cleanup

Historical completed diagnostic/preview/reconciliation branches remain. Delete them only when a genuine safe delete-ref operation is available. Never simulate deletion by moving stale refs to `main`.

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
