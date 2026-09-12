# ScopeForge Next Steps

Last verified: 2026-09-12.

## Released and validated

- Phase 10A1 PR #74 is merged as `33d21de652f3c04aa88ebd4f122348803e59b153`.
- Vercel production deployment `dpl_BFbUfBRQKCbMgHViMhsXX5kvfTYk` is READY. Connect and callback return HTTP 307 to the disabled integration path; callback clears transient cookies.
- Phase 10A2 PR #76 targets main at `47b5360cbf2a6b6388d77557cd9fcc14e2d618ff`, with zero commits behind released main.
- Phase 10A3 PR #77 is reconciled onto that Phase 10A2 head at `3282f83255b1d430919ac120d5f570f4eb7ee65b`, with zero commits behind its base. Later documentation-only commits may advance its head.
- Combined local validation: 411 test files / 1,894 tests, typecheck and production build passed. Follow-up CLI build/version, scanner benchmark and benchmark matrix passed; dependency audit reported zero vulnerabilities.
- Scanner benchmark: 700 files, 472 ms wall time versus 20,000 ms budget. Dependency, IaC and source-AST benchmark profiles all passed their budgets.
- Production password-sign-in without CAPTCHA was independently rejected with HTTP 400 / `captcha_failed` / `captcha protection: request disallowed (no captcha_token found)`. The Turnstile password-enforcement verification gap is closed.

## Priority 1 - activate and accept GitHub provider

This is access-blocked, not approval-blocked. Available Vercel tools expose project/deployment/log operations but no environment-management operation. This runtime has no Vercel token, authenticated Vercel CLI configuration, Supabase management token or SSH agent. Do not invent access or expose secrets in chat.

1. Obtain supported authenticated Vercel environment-management access for project `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`, team `team_WEcf1g1YcD6vYU8LD5jVUOKF`.
2. Verify/configure the six server-only GitHub App settings in `PHASE_10A1_GITHUB_APP_SETUP.md`. Keep each secret encrypted and out of browser/public variables, repository files and logs.
3. Verify GitHub App homepage/setup/callback URLs, installation-time OAuth disabled, and read-only Contents/Metadata permissions.
4. Deliberately enable `HOSTED_GITHUB_INTEGRATION_ENABLED=true` for the controlled owner/admin canary and redeploy as required.
5. Prove Connect GitHub -> installation proof -> repository listing -> import, including persistence and credential-leak checks. Disable immediately on failure.
6. Keep all hosted worker flags disabled until their independent acceptance.

Fresh database check still reports zero GitHub connections and zero repository links. Configuration presence and provider canary are not proven by code or CI checks.

## Priority 2 - private repository operational acceptance

PR #76 remains draft. After the GitHub provider acceptance:

1. Re-read current branch heads and migration history.
2. Review/apply only absent Phase 10A2 forward migrations in the correct ScopeForge project `tdgpibrepzcvdivztkta`; verify ACL/RLS/RPC boundaries and advisors.
3. Obtain access to the dedicated worker environment and verify containment, quotas, cleanup, observability and rollback.
4. Verify intended read-only private repository access.
5. Enable only the accepted canary execution class; prove private archive lease -> immutable snapshot -> exact zero-egress scan -> findings.
6. Confirm provider credentials never enter worker contracts and source/capabilities do not leak. Disable on failure.
7. Merge/release only after code, schema, provider and runtime acceptance pass.

## Priority 3 - webhook operational acceptance

PR #77 remains draft and sequenced behind Phase 10A2.

1. Reconcile onto released Phase 10A2/main and revalidate that candidate.
2. Apply only reviewed absent Phase 10A3 migrations; verify private persistence, service-only RPCs and advisors.
3. Configure the independent webhook secret and reviewed endpoint/events through supported provider access.
4. Prove invalid-signature/size rejection, delivery replay idempotency, installation/repository lifecycle handling, latest-head coalescing and a full automatic scan.
5. Verify no raw webhook payload, signature, token, archive URL or private source leaks into browser state or ordinary logs.
6. Release only after those operational checks succeed.

## Independent remaining hardening

- Vercel WAF/rate-limit configuration remains unverified. Read the authenticated firewall configuration first; any new rule starts in log-only mode with matched-traffic review before enforcement.
- Supabase leaked-password protection remains disabled and was previously established as plan-gated on the current Free organization. Do not purchase an upgrade or change unrelated auth behavior to silence the warning.
- The private GitHub scan-intent RLS/no-policy INFO is intentional for its service-only boundary.
- CAPTCHA evidence covers password sign-in rejection without a token. It does not claim a successful interactive challenge or acceptance of every Auth endpoint.

## Boundaries

Preserve the released UI/admin/auth/CSP baseline, workspace authorization, immutable snapshot provenance, public/private execution-class separation, webhook HMAC verification before parsing, and default-off hosted capabilities. No Phase 10A2/10A3 production migrations or runtime flags were changed during this continuation.
