# ScopeForge Next Steps

Last reconciled: 2026-09-11 (Asia/Singapore)

## Released baseline

Current released `main`:

`1151af2dddb76737ee2f0a0d1a802f06a975d318`

Current production deployment:

`dpl_AueSXj9wWBDMkRTRLAb6x8nsH57z` - READY on `scopeforge.dev`

Released boundaries include Phases 1-9E, strict CSP, accepted Command Center V5, and Phase 10C platform administration.

Do not regress the V5/CSP/auth/RLS/worker-authority baseline while completing later phases.

## Priority 1 - safely release Phase 10A1

Active PR: #74
Branch: `feat/phase-10a-github-connected-projects`
Exact executable candidate before documentation reconciliation: `005504387cf29d65d6b297acb041b608f0416c1a`
CI #852 / run `34520609482`: SUCCESS

The code implementation is complete for the Phase 10A1 public-repository connected-project core, including exact-snapshot recovery for delayed scan continuation.

Remaining release gates are operational rather than feature-design work:

1. Restore a supported Supabase production management surface.
2. Read the fresh ScopeForge migration head; never substitute the Job Command Center project.
3. Apply/reconcile the four reviewed Phase 10A1 migrations in order if they are not already present.
4. Verify the created tables/RPCs, browser grants/RLS, exact-snapshot recovery function and function ACLs.
5. Run Supabase Security Advisor and resolve any Phase 10A1-introduced finding before merge.
6. Verify required GitHub App server-only provider configuration without exposing secret values.
7. Perform live Connect GitHub -> installation proof -> repository list -> repository import acceptance when provider configuration is available.
8. Keep all hosted worker flags off unless their independent canary/rollback gate has passed.
9. Re-run exact-head CI after any executable code or migration modification.
10. Merge PR #74 only when these production safety conditions are satisfied.
11. After merge, verify the production deployment serves public V5, auth, dashboard, admin, GitHub integration routes, and existing security headers without regression.

The final-candidate GitHub Vercel status currently reports the Hobby-plan build-rate limit. This is an external preview quota condition, not a code build failure; GitHub CI #852 passed the exact candidate's Next.js build and browser checks. Do not conceal the quota condition, but do not misclassify it as an application regression.

Detailed evidence: `docs/development/PHASE_10A1_RELEASE_STATE.md`.

## Priority 2 - Phase 10A2 private repository acquisition

Start only after Phase 10A1 is safely released.

Requirements:

- keep private-source acquisition as a distinct execution class,
- use short-lived repository-scoped GitHub installation credentials,
- never weaken or repurpose `repository_snapshot_github_public_v1`,
- prevent private source, archive bytes, tokens and provider responses from browser persistence/logging,
- preserve immutable snapshot provenance and exact-snapshot scan binding,
- TDD the private/public isolation boundary before implementation,
- retain the same project-level UX so users do not need to understand worker internals.

Deployment discovery/DAST integration remains a later connected-project phase after private repository acquisition is stable.

## Priority 3 - independent hosted runtime acceptance

Phase 10A product releases do not automatically authorize dormant worker activation.

Keep these false/absent until independent operational canary and rollback acceptance explicitly authorizes each capability:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

A canary must prove the exact worker class, containment, quotas, cancellation/recovery, observability, and rollback path before its flag changes in production.

## Priority 4 - remaining provider/security follow-ups

- Supabase leaked-password protection was last verified disabled; enable only through a supported Auth-management surface and re-verify auth flows.
- Verify Turnstile production enforcement rather than inferring it from configuration code.
- Verify any Vercel WAF/rate-limit controls through a supported management surface.
- Preserve strict nonce CSP and existing browser security headers during all provider changes.

## Branch cleanup

Historical completed diagnostic/preview/reconciliation branches remain. Delete them only when a genuine safe delete-ref operation is available. Never simulate deletion by moving stale refs to `main`.

## Baseline rule

Any next implementation work must preserve together:

- accepted Command Center V5 desktop/mobile presentation,
- Phase 10C admin console and authority separation,
- strict nonce CSP,
- Supabase workspace/RLS/RPC authorization,
- no browser service-role/provider secrets,
- worker/runtime authority separation,
- disabled/unaccepted hosted capability defaults,
- immutable snapshot and finding provenance.
