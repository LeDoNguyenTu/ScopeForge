# ScopeForge Next Steps

Last verified: 2026-09-12.

## Current validated stack

- Phase 10A1 PR #74 is merged as `33d21de652f3c04aa88ebd4f122348803e59b153` and remains production-dark behind the GitHub integration release gate.
- Phase 10A2 PR #76 remains draft at `709ef8af4ce4befae12ba910d3bca15599b5cab1`.
- Phase 10A3 PR #77 remains draft and stacked on #76.
- Latest verified Phase 10A3 executable head: `9c40e89bb9433d8b4ce268302e1a9e5b04f29151`.
- CI #962 / run `34687506721` against synthetic merge `333711dfa8490fc137999dfb98d25ad9f248c5bd`: SUCCESS.
- Validation: audit 0 vulnerabilities, 412 / 412 test files, 1,896 / 1,896 tests, typecheck, CLI build/version, scanner benchmark, benchmark matrix, optimized production build, CSP browser acceptance and production UI/Turnstile diagnostic all passed.
- Visual acceptance artifact: `10296117940`.
- Issue #78 bounded webhook streaming hardening is closed and completed.
- Issue #80 same-head pending enqueue race hardening is closed and completed.
- No Phase 10A2/10A3 production migration was applied, no provider/webhook secret was exposed, no webhook was registered and no hosted worker runtime flag was enabled.

Documentation-only commits after `9c40e89bb9433d8b4ce268302e1a9e5b04f29151` do not replace CI #962 as exact executable validation evidence. Any later executable change requires fresh validation.

## Priority 1 - GitHub provider operational acceptance

Tracked in issue #79. This is access-blocked, not approval-blocked.

The current Vercel connector can inspect projects, deployments and logs but cannot manage production environment variables. Do not paste provider secrets into chat, issues, PR comments, repository files, browser-readable variables or logs.

1. Use a supported authenticated Vercel environment-management surface for project `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`, team `team_WEcf1g1YcD6vYU8LD5jVUOKF`.
2. Verify/configure the six server-only GitHub App values from `PHASE_10A1_GITHUB_APP_SETUP.md`: `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG`, `GITHUB_APP_STATE_SECRET`.
3. Verify homepage `https://scopeforge.dev`, setup/callback `https://scopeforge.dev/api/integrations/github/callback`, installation-time OAuth disabled, Contents read-only and Metadata read-only.
4. Keep `HOSTED_GITHUB_INTEGRATION_ENABLED` false/missing until those settings are verified. Set exact `true` only for the controlled owner/admin canary.
5. Prove Connect GitHub -> installation proof -> repository listing -> one repository import, including persistence, wrong-installation rejection, role authorization and leak checks.
6. Disable the gate immediately on any failure.
7. Keep all hosted worker runtime flags disabled throughout this provider-only acceptance.

Code/CI success does not substitute for this live provider acceptance.

## Priority 2 - Phase 10A2 private repository operational acceptance

After Priority 1 passes:

1. Re-read PR #76 head and production migration history.
2. Apply only absent reviewed Phase 10A2 forward migrations in ScopeForge Supabase project `tdgpibrepzcvdivztkta`; verify ACL/RLS/RPC boundaries and advisors.
3. Obtain the dedicated worker environment and verify containment, quotas, cleanup, observability and rollback.
4. Verify intended read-only private repository access.
5. Enable only the accepted private acquisition canary execution class and prove private archive lease -> immutable snapshot -> exact zero-egress scan -> findings.
6. Confirm provider credentials never enter worker contracts and private source/capabilities do not leak.
7. Disable on failure. Merge/release #76 only after provider, schema and runtime acceptance all pass.

Static review already rechecked the private archive trust boundary and found no additional actionable defect: authoritative repository/commit identity is control-plane-bound, the worker revalidates the exact codeload host/path/commit, and the snapshot reader independently enforces streamed archive bounds.

## Priority 3 - Phase 10A3 webhook operational acceptance

After PR #76 is released:

1. Reconcile PR #77 onto released Phase 10A2/main and perform fresh exact-candidate validation.
2. Apply only reviewed absent Phase 10A3 migrations, including `20260912024000_phase_10a3_same_head_pending_recovery.sql`; verify private persistence, service-only RPCs, ACL/RLS and advisors.
3. Configure the independent webhook secret and reviewed endpoint/events through a trusted provider surface.
4. Prove invalid-signature rejection, declared/actual oversized-body rejection, delivery replay idempotency, installation/repository lifecycle handling and latest-head coalescing.
5. Explicitly canary the #80 same-head race: a newer same-head delivery must be able to own enqueue if `pending=true` has no active intent, while stale older enqueue attempts remain rejected.
6. Prove public/private acquisition-class separation and a full automatic scan through immutable snapshot publication to findings.
7. Verify no raw webhook payload, signature, token, archive URL or private source leaks into browser state, persistence or ordinary logs.
8. Merge/release #77 only after all operational checks pass.

Do not redo #78 or #80 unless later reconciliation changes their executable behavior.

## Repository hygiene

`docs/development/BRANCH_CLEANUP_CANDIDATES.md` is refreshed on PR #76. Retain `main`, the Phase 10A2 branch, the Phase 10A3 branch and `demo/portfolio-20260910`.

The current GitHub connector has no genuine delete-ref operation. Do not simulate branch deletion by force-moving refs.

## Independent maintenance queue

These are not release blockers for the current Phase 10A stack, but can be cleaned up independently after security hardening evidence is stable:

- Vite warns that `vitest.config.ts` uses ESM syntax while the nearest package defaults to CommonJS; future native config loading may reject that shape. Isolate any module-format correction and verify the full test suite.
- `actions/upload-artifact@v4` emits a GitHub-hosted Node runtime deprecation warning while being forced onto Node 24. Verify the supported current action major before changing the workflow.
- Vercel custom WAF/rate-limit configuration remains unverified and requires authenticated configuration access.
- Supabase leaked-password protection remains plan-gated on the current Free organization.
- The private GitHub scan-intent RLS/no-policy INFO remains intentional for its service-only boundary.
- CAPTCHA evidence proves password sign-in rejects missing CAPTCHA tokens; it does not claim successful interactive acceptance for every Auth endpoint.

## Boundaries

Preserve the released UI/admin/auth/CSP baseline, workspace authorization, immutable snapshot provenance, public/private execution-class separation, webhook raw-byte HMAC verification before JSON parsing, exact stale-delivery checks and default-off hosted capabilities.

Never skip stack order or infer provider/runtime acceptance from code or CI alone.
