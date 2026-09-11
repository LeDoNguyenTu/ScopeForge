# ScopeForge Next Steps

Last reconciled: 2026-09-11 (Asia/Singapore)

## Released baseline

Current released `main`:

`1151af2dddb76737ee2f0a0d1a802f06a975d318`

Current production deployment:

`dpl_AueSXj9wWBDMkRTRLAb6x8nsH57z` - READY on `scopeforge.dev`

Released boundaries include Phases 1-9E, strict CSP, accepted Command Center V5, and Phase 10C platform administration.

Do not regress the V5/CSP/auth/RLS/worker-authority baseline while completing later phases.

## Phase 10A2 executable validation completed

Active PR: #76

Branch: `feat/phase-10a2-private-repository-acquisition`

Exact executable candidate:

`3b1957871103885ac4fd26e3d3ff91f5d4a5a24f`

CI #897 / run `34606962246`: SUCCESS.

The exact executable candidate passed:

- dependency installation,
- `npm audit --audit-level=info` with 0 vulnerabilities,
- 392 Vitest files and 1,731 tests,
- TypeScript typecheck,
- CLI build and version execution,
- scanner benchmark,
- matrix benchmark,
- production Next.js build,
- strict CSP browser smoke,
- production V5/Turnstile diagnostic,
- UI artifact upload step.

The Phase 10A2 changed-file security review also completed without an identified release-blocking code defect. Credential boundaries, codeload-only private acquisition, public/private worker class separation, exact task/lease/snapshot binding, retry/expiry handling, privileged RPC ACLs and runtime gates were reviewed.

Any later executable change invalidates this executable evidence and requires a fresh complete validation run.

Detailed state: `docs/development/PHASE_10A2_WORKING_STATE.md`.

## Priority 1 - safely release Phase 10A1 and reconcile the stack

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

PR #76 must remain draft or otherwise non-releasable until this stack sequence is complete.

## Priority 2 - Phase 10A2 production schema/provider/private canary

Do not enable the private acquisition runtime merely because the repository code is green.

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

## Priority 3 - independent hosted runtime acceptance

Phase 10A product releases do not automatically authorize dormant worker activation.

Keep these false/absent until independent operational canary and rollback acceptance explicitly authorizes each capability:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

A canary must prove the exact worker class, containment, quotas, cancellation/recovery, observability, and rollback path before its flag changes in production.

## Priority 4 - remaining provider/security follow-ups

- Supabase leaked-password protection was last verified disabled; enable only through a supported Auth-management surface and re-verify auth flows.
- Verify Turnstile production enforcement rather than inferring it from configuration code.
- Verify any Vercel WAF/rate-limit controls through a supported management surface.
- Preserve strict nonce CSP and existing browser security headers during all provider changes.
- Continue deployment discovery/DAST as a later connected-project phase only after private repository acquisition is stable and released.

## Branch cleanup

Remove temporary Phase 10A2 validation marker files before final branch handoff. Historical completed diagnostic/preview/reconciliation branches remain. Delete them only when a genuine safe delete-ref operation is available. Never simulate deletion by moving stale refs to `main`.

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
