# ScopeForge Next Steps

## Webhook reconciliation checkpoint - 2026-09-12

This checkpoint supersedes older stack status below.

- Phase 10A1 is released as `33d21de652f3c04aa88ebd4f122348803e59b153`; Vercel production is READY and live connect/callback probes confirm the integration is disabled.
- Phase 10A2 PR #76 targets main at `47b5360cbf2a6b6388d77557cd9fcc14e2d618ff` and contains released main with no missing base commits.
- This Phase 10A3 reconciliation merges that exact Phase 10A2 head. Environment documentation retains webhook configuration, private archive secrecy, and the separate GitHub integration gate. The example environment has each key exactly once.
- Fresh local integrated validation: `npm test` passed 411 files / 1,894 tests; `npm run typecheck` exited 0; production `npm run build` exited 0 with the documented CI-only placeholder environment; `git diff --check` passed.
- A redundant Phase 10A2 test attempt overlapped the branch switch and is invalid as evidence. The completed stable Phase 10A2 run passed 402 files / 1,787 tests; the fresh stable Phase 10A3 run above is the combined-state evidence.
- No new hosted browser or runtime canary was performed for this combined branch. PR #77 remains draft and cannot release ahead of Phase 10A2 operational acceptance.
- Remaining: supported Vercel environment configuration access; GitHub App URL/permission verification; authenticated owner/admin connection/import acceptance; dedicated private-worker containment/end-to-end acceptance; then signed webhook replay/lifecycle/coalescing canaries. Apply reviewed Phase 10A2/10A3 migrations only in release order.
- No provider secret was created or exposed, no runtime flag was enabled, and no Phase 10A2/10A3 production migration was applied in this continuation.


## Continuation checkpoint - 2026-09-12

This checkpoint supersedes the older release status below.

- PR #74 merged as `33d21de652f3c04aa88ebd4f122348803e59b153` after final CI run `34678875883` succeeded (387 files, 1,726 tests, audit 0, typecheck, builds, benchmarks and browser acceptance).
- Vercel production deployment `dpl_BFbUfBRQKCbMgHViMhsXX5kvfTYk` is READY for that merge.
- Fresh production GET probes confirmed both GitHub connect and callback return HTTP 307 to `https://scopeforge.dev/dashboard/integrations/github?error=disabled`. Callback clears both transient cookies with Secure, HttpOnly and SameSite=Lax attributes.
- GitHub provider configuration and authenticated connection/import acceptance remain unverified. No integration or worker runtime flag was enabled.
- PR #76 now targets `main`. This reconciliation merges released main into Phase 10A2, retaining the Phase 10C admin console, GitHub release gate and private acquisition capability. The sole conflict in `docs/ENVIRONMENT.md` was resolved by retaining both the release-gate instructions and private archive lease secrecy rule.
- Local integrated validation: `npm test` passed 402 files / 1,787 tests; `npm run typecheck` exited 0; `git diff --check` passed.
- PR #76 remains draft. Provider/worker containment and private end-to-end canaries remain required before release. Phase 10A2/10A3 production migrations were not applied in this continuation.
- Next: propagate this reconciliation into PR #77, validate the combined candidate, then complete provider configuration and runtime acceptance in order. Earlier CI records below describe historical candidates only.


Last reconciled: 2026-09-12 (Asia/Singapore)

## Released baseline

Current released `main`:

`1151af2dddb76737ee2f0a0d1a802f06a975d318`

Production: `scopeforge.dev`.

Preserve the released Phases 1-9E, strict nonce CSP, accepted Command Center V5, and Phase 10C admin/RLS/authority baseline throughout the stacked GitHub releases.

## Priority 1 - complete Phase 10A1 provider acceptance and release

PR #74: `feat/phase-10a-github-connected-projects`

Exact head:

`17831b98dbbf06adf213cd2c8694ecd0d6852b74`

Fresh current-`main` integration evidence:

- current `main`: `1151af2dddb76737ee2f0a0d1a802f06a975d318`
- synthetic merge: `c53b21f0b28735f3fc3fa59c85414f977346a403`
- CI #949 / run `34656537969`: SUCCESS
- audit: 0 vulnerabilities
- 387 / 387 files, 1,720 / 1,720 tests
- typecheck, CLI, scanner + matrix benchmarks, production build, strict-CSP browser smoke, production V5/Turnstile diagnostic, and four-file artifact upload: PASS

Code and production database gates are complete. Production already records all five reviewed Phase 10A1 migrations and the verified least-privilege table/RPC authority model. Production still has zero GitHub connection/repository-link rows.

Remaining release work is provider-focused:

1. Verify `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG`, and `GITHUB_APP_STATE_SECRET` exist in the production server environment through a supported configuration surface without exposing values.
2. Verify GitHub App homepage `https://scopeforge.dev`, setup/callback `https://scopeforge.dev/api/integrations/github/callback`, installation-time user authorization disabled, and repository permissions limited to read-only Contents + Metadata.
3. Run an authenticated owner/admin `Connect GitHub -> installation proof -> repository listing -> repository import` canary.
4. Confirm App private key, OAuth token, installation token, signed state, authorization code, and raw provider error bodies do not appear in browser state, persisted integration rows, redirects, or ordinary logs.
5. Keep hosted worker flags off.
6. Merge PR #74 only after the live provider canary succeeds.
7. Verify the merged production deployment, integration routes, V5/admin/auth paths, and security headers.

Do not substitute preview readiness, CI success, source inspection, or zero-error logs for the authenticated provider canary.

## Priority 2 - release Phase 10A2 only after Phase 10A1

PR #76: `feat/phase-10a2-private-repository-acquisition`

Exact head:

`e812a236f3782059e72a5fd2793d4f9b2641e81f`

CI #913 / run `34621671597`: SUCCESS with 393 files / 1,732 tests and the complete audit/type/CLI/benchmark/build/browser/diagnostic matrix.

After Phase 10A1 releases:

1. Retarget/reconcile PR #76 onto released `main` and revalidate the new synthetic merge candidate.
2. Read the exact ScopeForge production migration head.
3. Apply only the reviewed Phase 10A2 forward migrations that are absent.
4. Verify private tables/RPCs, explicit revokes/grants, RLS, and service-role authority boundaries; rerun Security Advisor.
5. Verify GitHub App access to a controlled private test repository using the intended read-only permissions.
6. Verify the dedicated private snapshot worker deployment, containment, observability, cleanup, and rollback mechanism.
7. Enable `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` only in the accepted canary environment.
8. Run one complete private connected-project canary: request -> private archive lease -> immutable snapshot publication -> exact zero-egress repository scan -> findings.
9. Verify provider credentials never enter worker contracts and private source/capabilities do not appear in browser state or ordinary logs.
10. Disable immediately on identity, credential, network, containment, publication, or cleanup failure.
11. Merge/release Phase 10A2 only after every code, schema, provider, and runtime gate is green.

## Priority 3 - release Phase 10A3 only after Phase 10A2

PR #77: `feat/phase-10a3-github-webhook-reconciliation`

Validated pre-reconciliation head:

`3cf6dc800eafeb7967b231063afb2e4177acf64f`

Final docs-inclusive CI #948 / run `34656348562`: SUCCESS against exact Phase 10A2 base `e812a236f3782059e72a5fd2793d4f9b2641e81f` using synthetic merge `87e11f9e22bb79e6f9810860ed182a85cc868fd2`.

Final evidence at that head:

- audit: 0 vulnerabilities
- 402 / 402 files, 1,839 / 1,839 tests
- all eight manual/automatic terminal-reconciliation regressions: PASS
- typecheck, CLI, scanner + matrix benchmarks, optimized production build, strict-CSP browser smoke, production V5/Turnstile diagnostic, and four-file artifact upload: PASS

After Phase 10A2 releases:

1. Retarget/reconcile PR #77 onto released `main`; rerun exact-head validation because the merge candidate will change.
2. Read production migration history and apply only absent reviewed Phase 10A3 forward migrations.
3. Verify private webhook delivery/auto-scan state tables have RLS enabled with no browser policies/grants.
4. Verify every Phase 10A3 privileged RPC is `SECURITY DEFINER`, pins `search_path = ''`, fully qualifies objects, revokes default/browser execution, and grants only the reviewed `service_role` boundary.
5. Run Supabase Security Advisor and inspect every new finding.
6. Configure the independent production `GITHUB_APP_WEBHOOK_SECRET` through an encrypted server-only surface.
7. Register `https://scopeforge.dev/api/integrations/github/webhook` with only the reviewed GitHub App events.
8. Prove invalid signatures and oversized/malformed deliveries fail before persistence/provider work.
9. Prove replay of the same delivery UUID is idempotent and creates no duplicate automatic chain.
10. Prove rapid default-branch pushes coalesce to the newest authoritative provider head and schedule at most one follow-up after an active scan.
11. Prove installation/repository lifecycle changes reconcile by stable numeric identity and provider-authoritative metadata without auto-importing new repositories.
12. Run one end-to-end automatic scan canary through immutable snapshot publication, exact zero-egress scan continuation, findings, and successful-head watermark advancement.
13. Verify webhook secrets/signatures/raw payloads, provider tokens, temporary archive URLs, private source, and worker capabilities do not appear in browser state, persistence contracts, redirects, or ordinary logs.
14. Keep runtime flags at their independently accepted settings; Phase 10A3 does not authorize a new worker capability.
15. Merge/release Phase 10A3 only after the stack, schema, provider, webhook, replay, lifecycle, coalescing, and end-to-end canaries are all green.

## Priority 4 - independent auth/edge hardening follow-ups

These items are approved follow-ups but are not substitutes for the Phase 10A release gates.

### Supabase leaked-password protection

Fresh Supabase project/org inspection confirms the ScopeForge organization is on the `free` plan. Current Supabase documentation states leaked-password protection requires Pro or above. Leave the advisor warning documented on the current plan; do not modify unrelated auth/database behavior to silence it. If the project upgrades, enable leaked-password protection and rerun Security Advisor.

### Turnstile production enforcement

The production UI visibly loads Turnstile and passes `captchaToken` to Supabase Auth. Close the remaining verification gap by proving Supabase Auth rejects password authentication without a CAPTCHA token when a supported POST-probe or hosted Auth configuration surface is available. UI visibility alone is insufficient.

### Vercel WAF/rate limiting

Vercel platform DDoS mitigation is automatic, but custom WAF/rate-limit posture must be read from an authenticated firewall configuration surface. The current connected Vercel tools expose projects/deployments/logs but not live firewall config, and this execution container has no authenticated Vercel CLI. When a supported surface is available, inspect current rules first; stage any new rule in log-only mode and review matched traffic before production enforcement.

## Independent hosted runtime acceptance

Keep these false/absent until operational canary and rollback acceptance explicitly authorizes each capability:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

A canary must prove the exact worker class, containment, quotas, cancellation/recovery, observability, and rollback path before its flag changes in production.

## Baseline rule

Any next implementation/release work must preserve together:

- accepted Command Center V5 desktop/mobile presentation
- Phase 10C admin console and authority separation
- strict nonce CSP
- Supabase workspace/RLS/RPC authorization
- no browser `service_role` or provider secrets
- no GitHub provider credentials in worker contracts
- public/private repository acquisition class separation
- webhook HMAC verification before parse/persistence
- no raw webhook body/signature/secret persistence
- latest-authoritative-head coalescing
- worker/runtime authority separation
- disabled/unaccepted hosted capability defaults
- immutable snapshot and finding provenance
- exact-snapshot recovery without implicit reacquisition
