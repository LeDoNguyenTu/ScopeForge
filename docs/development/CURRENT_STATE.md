# ScopeForge Current State

Last reconciled: 2026-09-11 (Asia/Singapore)

## Released baseline

- repository: `LeDoNguyenTu/ScopeForge`
- current released `main`: `1151af2dddb76737ee2f0a0d1a802f06a975d318`
- released `main` includes Phase 10C platform administration
- production deployment: `dpl_AueSXj9wWBDMkRTRLAb6x8nsH57z`
- production deployment state: READY
- production domain: `scopeforge.dev`
- deployment alias error: none

The released `main` tree remains authoritative until a later PR is merged and production-verified.

## Released capability and security baseline

Released work includes:

- Phases 1 through 6D
- Phase 7 Community Security Packs v1
- Phase 8A offline accuracy foundation
- Phase 8B deterministic scanner performance matrix
- Phase 8C reproducible technical publication
- Phase 9A authentication-boundary hardening
- Phase 9B provider/auth hardening code
- Phase 9C database/RPC defense-in-depth
- Phase 9D security telemetry/browser hardening
- Phase 9E incident readiness and release engineering
- strict nonce-based CSP compatibility/enforcement
- accepted Command Center V5 restoration
- Phase 10C platform admin console and production owner bootstrap

Phase 10C production database evidence remains documented in `PHASE_10C_WORKING_STATE.md`.

## Production UI and browser security

The accepted Command Center V5 public/authenticated presentation remains authoritative.

Current production baseline keeps:

- strict nonce CSP with `strict-dynamic`,
- no permanent production `unsafe-inline` or `unsafe-eval`,
- HSTS,
- nosniff,
- frame denial,
- referrer policy,
- permissions policy,
- authenticated dashboard boundaries,
- public WebGL/V5 composition.

PR #74 CI #852 also re-ran the production V5/Turnstile diagnostic and strict-CSP browser smoke successfully while validating the Phase 10A1 merge candidate against current `main`.

## Supabase baseline

ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Last verified Phase 10C migrations:

- `20260910153743_phase_10c_platform_admin`
- `20260910154017_phase_10c_explicit_browser_deny_policies`

The Phase 10C owner bootstrap and browser/RPC boundaries were verified before PR #75 merged. The only known Security Advisor warning at that verification point was the project-level leaked-password-protection setting being disabled.

A fresh production migration read was attempted during Phase 10A1 release work on 2026-09-11, but the connected Supabase database action became unavailable. No Phase 10A1 or Phase 10A2 production schema mutation should be inferred after that failure. Treat the migration list above as the last verified state, not a fresh read.

## Active release candidate - Phase 10A1

PR #74 (`feat/phase-10a-github-connected-projects`) implements the GitHub connected-project public repository core.

Exact executable candidate before documentation reconciliation:

`005504387cf29d65d6b297acb041b608f0416c1a`

CI #852 / run `34520609482`: SUCCESS.

That validation passed dependency audit, 1,719 tests, typecheck, CLI, both scanner benchmarks, Next.js build, CSP browser smoke, production diagnostic, and artifact upload against the PR merge result with current `main`.

The implementation includes:

- GitHub App connection with signed ScopeForge user/workspace state,
- authenticated GitHub-user proof of installation access,
- ephemeral read-only installation credentials,
- repository picker/import with authoritative server re-fetch,
- verified repository asset/link creation,
- one-click connected-project scanning for public repositories,
- immutable snapshot-to-scan continuation,
- exact-snapshot recovery for `waiting_scan_runtime` and `retry_pending`,
- no implicit second snapshot during recovery,
- fresh GitHub revalidation before recovery,
- preserved private-repository Phase 10A2 boundary.

Detailed evidence: `PHASE_10A1_RELEASE_STATE.md`.

Phase 10A1 is not released yet. Its production database migrations and live GitHub App provider configuration are not freshly verified/applied in the current session.

## Active stacked implementation - Phase 10A2

PR #76 (`feat/phase-10a2-private-repository-acquisition`) is the stacked private-repository acquisition implementation.

Current implemented scope includes:

- distinct `repository_snapshot_github_private_v1` worker execution class,
- separate default-off `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` gate,
- control-plane-only GitHub installation credential use,
- attempt-bound `github_private_archive_lease_v1` capability instead of provider credentials in worker contracts,
- exact `codeload.github.com` private archive acquisition with bounded processing,
- private snapshot persistence/publication through reviewed privileged RPCs,
- Phase 10A2 database type overlay that preserves Phase 6D worker-control RPCs,
- private connected-project request routing without fallback to public acquisition,
- fail-closed handling when repository visibility changes,
- private snapshot publication recognition in the authenticated worker finalize route,
- exact-snapshot continuation into the existing zero-egress repository scanner,
- private recovery/retry support for retained published snapshots,
- dashboard project-level scan UX for private repositories,
- permanent Phase 10A2 architecture guards.

Detailed working state: `PHASE_10A2_WORKING_STATE.md`.

PR #76 is not release-ready yet. The exact current candidate still requires fresh complete validation, Phase 10A1 release reconciliation, production Supabase migration/ACL verification, GitHub App private-repository provider verification, private worker canary and rollback acceptance.

## Provider and runtime truth

Current conservative state:

- strict CSP: ENFORCED
- Phase 10C admin database/owner bootstrap: LAST VERIFIED COMPLETE
- Supabase leaked-password protection: last verified disabled; current mutation surface unavailable
- Phase 10A1 GitHub App live provider configuration: NOT VERIFIED
- Phase 10A1 production schema: NOT APPLIED/VERIFIED IN CURRENT SESSION
- Phase 10A2 production schema: NOT APPLIED/VERIFIED IN CURRENT SESSION
- Phase 10A2 private GitHub canary: NOT RUN
- final Phase 10A1/10A2 Vercel preview failures may include Hobby-plan build-rate limits and must be distinguished from application build failures

Keep these false/absent until independent canary and rollback acceptance explicitly authorizes them:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Branch hygiene

Historical completed diagnostic/preview/reconciliation branches still exist. Delete them only through a genuine safe delete-ref operation. Do not simulate deletion by force-moving stale branches.

## Immediate engineering boundary

1. Run fresh exact-head Phase 10A2 validation and repair any executable regression using focused TDD.
2. Complete the Phase 10A2 changed-file security review and documentation reconciliation.
3. Safely finish/release Phase 10A1 and retarget/reconcile PR #76 onto the released baseline.
4. Re-run the complete Phase 10A2 exact-head validation after reconciliation.
5. Restore a supported Supabase management surface, verify/apply only reviewed forward migrations, and verify RPC ACL/RLS/security-advisor state.
6. Verify GitHub App private-repository permissions and run a dedicated private acquisition canary with rollback readiness.
7. Merge/release Phase 10A2 only after every code, provider, schema and runtime gate is satisfied.
8. Continue independent hosted-runtime canary/rollback work without treating product implementation as runtime authorization.

## Production services

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8` (`scopeforge`)
- production: `scopeforge.dev`
