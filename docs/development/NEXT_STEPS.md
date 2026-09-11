# ScopeForge Next Steps

Last reconciled: 2026-09-12 (Asia/Singapore)

## Released baseline

Current released `main`:

`1151af2dddb76737ee2f0a0d1a802f06a975d318`

Production: `scopeforge.dev`.

Released boundaries include Phases 1-9E, strict CSP, accepted Command Center V5, and Phase 10C platform administration. Do not regress the V5/CSP/auth/RLS/worker-authority baseline while completing the stacked GitHub phases.

## Priority 1 - finish Phase 10A1 provider acceptance and release

Active PR: #74
Branch: `feat/phase-10a-github-connected-projects`
Exact head: `17831b98dbbf06adf213cd2c8694ecd0d6852b74`
CI #912 / run `34611735763`: SUCCESS

Code and production database gates are complete. Production already records all five reviewed Phase 10A1 migrations and the verified least-privilege table/RPC authority model.

Remaining release work is provider-focused:

1. Verify the six Phase 10A1 GitHub App server-only settings through a supported configuration surface without exposing values.
2. Verify production homepage/setup/callback URLs and read-only Contents/Metadata permissions.
3. Run an authenticated owner/admin `Connect GitHub -> installation proof -> repository listing -> repository import` canary.
4. Confirm the App private key, OAuth token, installation token, signed state, and raw provider error body do not appear in browser state, persisted integration rows, redirects, or ordinary logs.
5. Keep hosted worker flags off.
6. Merge PR #74 only after the live provider canary succeeds.
7. Verify the merged production deployment, integration routes, V5/admin/auth paths, and security headers.

Do not substitute preview readiness, build success, source inspection, or a zero-error log search for the authenticated provider canary.

## Priority 2 - release Phase 10A2 only after Phase 10A1

PR #76 is already reconciled exactly onto Phase 10A1.

Current Phase 10A2 head:

`e812a236f3782059e72a5fd2793d4f9b2641e81f`

CI #913 / run `34621671597`: SUCCESS with 393 files / 1,732 tests and the complete audit/type/CLI/benchmark/build/browser/diagnostic matrix.

After Phase 10A1 releases:

1. Retarget/reconcile PR #76 onto released `main`; revalidate if GitHub's merge candidate changes.
2. Read the exact ScopeForge production migration head.
3. Apply only the reviewed Phase 10A2 forward migrations that are absent.
4. Verify private tables/RPCs, explicit revokes/grants, RLS, and service-role authority boundaries; run Security Advisor.
5. Verify GitHub App access to a selected private test repository with intended read-only permissions.
6. Verify the dedicated private snapshot worker deployment, containment, observability, and rollback mechanism.
7. Enable `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` only in the accepted canary environment.
8. Run one complete private connected-project canary: project scan request -> private archive lease -> immutable snapshot publication -> exact zero-egress repository scan -> findings.
9. Verify provider credentials never enter worker contracts and private source/capabilities do not appear in browser state or ordinary logs.
10. Disable immediately on identity, credential, network, containment, publication, or cleanup failure.
11. Merge/release Phase 10A2 only after every code, schema, provider, and runtime gate is green.

## Priority 3 - finish Phase 10A3 documentation/security review

PR #77: `feat/phase-10a3-github-webhook-reconciliation`
Base: exact Phase 10A2 head `e812a236f3782059e72a5fd2793d4f9b2641e81f`

Latest executable-validation head:

`2a99c0fb91d1b28c309cf145f1367cbffa3410c3`

CI #938 / run `34653612240`: SUCCESS across dependency install, 0-vulnerability audit, complete tests, typecheck, CLI build/version, both scanner benchmarks, production Next.js build, strict-CSP smoke, production V5/Turnstile diagnostic, and artifact handling.

Task 8 work before release sequencing is considered complete:

1. Reconcile `README.md`, architecture, environment, current-state, next-steps, and Phase 10A3 working-state documentation.
2. Document all seven server-only GitHub App settings, including independent `GITHUB_APP_WEBHOOK_SECRET`.
3. Review every Phase 10A3 changed file for raw-payload/signature/secret/token persistence, browser exposure, HMAC ordering, replay races, provider-trust mistakes, lifecycle races, public/private class collapse, runtime-gate bypass, and finalization replay.
4. Compare the documentation head to executable GREEN head `2a99c0fb...`; require only documentation/example-environment changes or rerun executable validation.
5. Run one final exact-head full CI before integration decisions.
6. Keep PR #77 stacked/draft until Phase 10A1 and Phase 10A2 release gates are complete.

## Priority 4 - Phase 10A3 production acceptance after Phase 10A2 release

Only after Phase 10A2 is released onto `main`:

1. Retarget/reconcile PR #77 onto released `main`; rerun exact-head validation if the merge candidate changes.
2. Read production migration history and apply only absent reviewed Phase 10A3 forward migrations.
3. Verify private webhook delivery/auto-scan state tables have RLS enabled with no browser policies/grants.
4. Verify every Phase 10A3 privileged RPC is `SECURITY DEFINER`, pins `search_path = ''`, fully qualifies objects, revokes default/browser execution, and grants only the reviewed `service_role` boundary.
5. Run Supabase Security Advisor and inspect any new finding rather than assuming it is intentional.
6. Configure the independent production `GITHUB_APP_WEBHOOK_SECRET` through an encrypted server-only surface.
7. Register `https://scopeforge.dev/api/integrations/github/webhook` with the reviewed GitHub App events only after configuration is verified.
8. Prove invalid signatures and oversized/malformed deliveries fail before persistence/provider work.
9. Prove a valid delivery UUID replay is idempotent and creates no duplicate automatic chain.
10. Prove default-branch rapid pushes coalesce to the newest authoritative provider head and schedule at most one follow-up after an active scan.
11. Prove installation/repository lifecycle changes reconcile by stable numeric identity and provider-authoritative metadata without auto-importing new repositories.
12. Run one end-to-end automatic scan canary through immutable snapshot publication, exact zero-egress scan continuation, findings, and successful-head watermark advancement.
13. Verify webhook secrets/signatures/raw payloads, App/provider tokens, temporary archive URLs, private source, and worker capabilities do not appear in browser state, persistence contracts, redirects, or ordinary logs.
14. Keep all runtime flags at their independently accepted settings; Phase 10A3 does not authorize a new worker capability.
15. Merge/release Phase 10A3 only after the stack, schema, provider, webhook, replay, lifecycle, coalescing, and end-to-end canaries are all green.

## Independent hosted runtime acceptance

Keep these false/absent until operational canary and rollback acceptance explicitly authorizes each capability:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

A canary must prove the exact worker class, containment, quotas, cancellation/recovery, observability, and rollback path before its flag changes in production.

## Remaining provider/security follow-ups

- Supabase leaked-password protection remains a separate Auth hardening item.
- Verify Turnstile production enforcement rather than inferring it from configuration code.
- Verify Vercel WAF/rate-limit controls through a supported management surface.
- Preserve strict nonce CSP and existing browser security headers during all provider changes.
- Deployment discovery/DAST remains a later connected-project capability and is not authorized by the GitHub repository phases.

## Baseline rule

Any next implementation/release work must preserve together:

- accepted Command Center V5 desktop/mobile presentation,
- Phase 10C admin console and authority separation,
- strict nonce CSP,
- Supabase workspace/RLS/RPC authorization,
- no browser `service_role` or provider secrets,
- no GitHub provider credentials in worker contracts,
- public/private repository acquisition class separation,
- webhook HMAC verification before parse/persistence,
- no raw webhook body/signature/secret persistence,
- latest-authoritative-head coalescing,
- worker/runtime authority separation,
- disabled/unaccepted hosted capability defaults,
- immutable snapshot and finding provenance,
- exact-snapshot recovery without implicit reacquisition.
