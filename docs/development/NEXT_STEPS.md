# ScopeForge Next Steps

Last verified: 2026-09-12.

## Released and validated

- Phase 10A1 PR #74 is merged as `33d21de652f3c04aa88ebd4f122348803e59b153`.
- Vercel production is READY. Production connect/callback remain on the disabled integration path until the controlled provider canary is authorized through the release gate.
- Phase 10A2 PR #76 remains draft on `feat/phase-10a2-private-repository-acquisition`. Its current head is `709ef8af4ce4befae12ba910d3bca15599b5cab1`; the latest commit is documentation-only branch-cleanup reconciliation.
- Phase 10A3 PR #77 remains draft on `feat/phase-10a3-github-webhook-reconciliation`, stacked on Phase 10A2.
- Phase 10A3 bounded webhook streaming hardening is complete. Exact implementation head `eb3dc7d35bf334b51b93ebdeb8011277028ae504` passed CI #959 / run `34681343582` against synthetic merge `4b5d2d287f6d747c69c769a70d63e1671f4ad3a2`.
- CI #959 passed `npm audit` with zero vulnerabilities, 411 / 411 test files and 1,895 / 1,895 tests, typecheck, CLI build/version, scanner benchmark, benchmark matrix, optimized production build, CSP browser smoke, production UI/Turnstile diagnostics, and visual acceptance artifact `10293699844`.
- The corresponding RED checkpoint was CI #958 / run `34681195661` at tests-only head `5de02284a16e79d03c2f275b990ae793a70687f9`. Exactly the new overflow-boundary regression failed, proving the prior unknown-length body path could consume beyond the 10 MiB application ceiling before rejection.
- Issue #78 is closed as completed. Unknown-length webhook bodies are now read incrementally, rejected when accumulated bytes exceed the ceiling, and cancelled on overflow/read failure while preserving exact raw bytes for HMAC verification before JSON parsing.
- Production password sign-in without CAPTCHA was independently rejected with HTTP 400 / `captcha_failed`; the password-enforcement verification gap remains closed.
- Fresh Vercel runtime-error inspection after this continuation found no production runtime error cluster in the last hour. The earlier one-off platform-availability error belonged to an older production deployment and is not currently reproducing.

## Priority 1 - GitHub provider operational acceptance

Tracked in issue #79. This is access-blocked, not approval-blocked.

The currently connected Vercel surface can inspect projects, deployments and logs, but does not expose production environment-variable management. Do not invent access and do not paste provider secrets into chat, GitHub issues, PR comments, repository files, browser-readable variables, or logs.

1. Use a supported authenticated Vercel environment-management surface for project `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`, team `team_WEcf1g1YcD6vYU8LD5jVUOKF`.
2. Verify/configure the six server-only GitHub App values documented in `PHASE_10A1_GITHUB_APP_SETUP.md`: `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG`, and `GITHUB_APP_STATE_SECRET`.
3. Verify GitHub App homepage `https://scopeforge.dev`, setup/callback `https://scopeforge.dev/api/integrations/github/callback`, installation-time OAuth disabled, Contents read-only and Metadata read-only.
4. Keep `HOSTED_GITHUB_INTEGRATION_ENABLED` missing/false until provider settings are confirmed. Set exact `true` only for the controlled owner/admin canary.
5. Prove Connect GitHub -> installation proof -> repository listing -> one repository import, including persistence, wrong-installation rejection, role authorization and credential-leak checks.
6. Disable the gate immediately if any acceptance check fails.
7. Keep all hosted worker runtime flags disabled until their independent acceptance.

Fresh production database checks before this continuation reported zero GitHub connections and zero repository links. Code/CI success does not substitute for provider acceptance.

## Priority 2 - Phase 10A2 private repository operational acceptance

PR #76 remains draft. After provider acceptance:

1. Re-read the current branch head and production migration history.
2. Review/apply only absent Phase 10A2 forward migrations in the correct ScopeForge project `tdgpibrepzcvdivztkta`; verify ACL/RLS/RPC boundaries and advisors.
3. Obtain the dedicated worker environment and verify containment, quotas, cleanup, observability and rollback.
4. Verify intended read-only private repository access.
5. Enable only the accepted private acquisition canary class and prove private archive lease -> immutable snapshot -> exact zero-egress scan -> findings.
6. Confirm provider credentials never enter worker contracts and private source/capabilities do not leak.
7. Disable on failure and merge/release only after code, schema, provider and runtime acceptance pass.

Static review in this continuation rechecked the private archive trust boundary. The control plane binds authoritative repository/commit identity, the worker independently validates the exact codeload host/path/commit, and the snapshot reader independently enforces streamed archive safety bounds. No additional actionable Phase 10A2 defect was identified in that pass.

## Priority 3 - Phase 10A3 webhook operational acceptance

PR #77 remains draft and sequenced behind Phase 10A2.

1. After Phase 10A2 is released, reconcile PR #77 onto released Phase 10A2/main and perform fresh exact-candidate validation.
2. Apply only reviewed absent Phase 10A3 migrations; verify private persistence, service-only RPCs and advisors.
3. Configure the independent webhook secret and reviewed endpoint/events through supported provider access.
4. Prove invalid-signature and oversized-body rejection, delivery replay idempotency, installation/repository lifecycle handling, latest-head coalescing and a full automatic scan.
5. Verify no raw webhook payload, signature, token, archive URL or private source leaks into browser state or ordinary logs.
6. Release only after those operational checks succeed.

The code-level bounded-body gap found during this continuation is already fixed and verified by #78. Do not repeat that work unless later reconciliation changes the implementation.

## Repository hygiene

`docs/development/BRANCH_CLEANUP_CANDIDATES.md` was refreshed on PR #76. Active refs that must be retained are `main`, the Phase 10A2 branch, the Phase 10A3 branch, and the intentional demo/portfolio branch. The connected GitHub surface still exposes no genuine branch delete-ref action, so stale refs must not be simulated by force-moving them.

## Independent remaining hardening

- Vercel custom WAF/rate-limit configuration remains unverified. Read authenticated firewall configuration first; any new rule starts in log-only mode with matched-traffic review before enforcement.
- Supabase leaked-password protection remains disabled and was previously established as plan-gated on the current Free organization. Do not purchase an upgrade or change unrelated auth behavior merely to silence the warning.
- The private GitHub scan-intent RLS/no-policy INFO is intentional for its service-only boundary.
- CAPTCHA evidence covers password sign-in rejection without a token. It does not claim a successful interactive challenge or every Auth endpoint.
- CI currently emits non-blocking future-compatibility/deprecation warnings around Vite native config loading and GitHub Action Node runtimes. They did not fail CI #959 and are not Phase 10A2/10A3 release blockers in this checkpoint.

## Boundaries

Preserve the released UI/admin/auth/CSP baseline, workspace authorization, immutable snapshot provenance, public/private execution-class separation, webhook raw-byte HMAC verification before JSON parsing, and default-off hosted capabilities. No Phase 10A2/10A3 production migration, provider secret, webhook registration, or hosted worker runtime flag was changed during this continuation.
