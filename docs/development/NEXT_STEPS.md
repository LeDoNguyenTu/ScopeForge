# ScopeForge Next Steps

Last reconciled: 2026-09-08 (Asia/Singapore)

## Completed boundaries

Do not recreate these released phases:

- Phase 7 Community Security Packs v1
- Phase 8A offline accuracy foundation
- Phase 8B scanner performance matrix
- Phase 8C reproducible technical publication
- Phase 9A authentication-boundary hardening
- Phase 9C database/RPC defense-in-depth

Current production `main` baseline:

`0869767401011cd32dcd3e3b2976201461655e02`

Current production tree:

`ca68a0559af93fc3b2143fdec387b84e418bb141`

This tree includes the current production UI. All remaining security implementation must start from the actual current `main` rather than the historical Phase 9A baseline or PR #49.

## Immediate priority - Phase 9B provider/edge abuse controls

Implement Phase 9B as the next release boundary while preserving the current AuthForm and production UI composition.

Required sequence:

1. Re-read live Supabase Auth configuration and current Security Advisor.
2. Re-read current Vercel project/deployment/edge-control capabilities and authoritative platform docs before changing any edge rule.
3. Preserve Supabase native Auth rate limiting as the primary auth endpoint limiter. Do not add a custom application rate-limit package or state store without evidence that native/edge controls are insufficient.
4. Enable leaked-password protection when live plan/config capability supports it and an exact rollback path is recorded.
5. Add Cloudflare Turnstile to sign-in/sign-up using the current AuthForm structure and styling. Avoid a UI redesign. Prefer no new runtime dependency if the official integration can be implemented cleanly with a small local component and current provider API.
6. Keep production provider secret configuration separate from browser-visible site-key configuration. Never expose a Turnstile secret to the client bundle.
7. Apply Vercel WAF/rate-limit controls only through a supported inspected surface. Do not claim WAF state was changed if the connected platform cannot mutate it.
8. Exclude worker/control endpoints from generic interactive browser challenges.
9. Add focused regression tests before implementation changes and preserve Phase 9A auth error/redirect behavior.
10. Verify exact-head preview, frozen CI, production deployment, Supabase advisor/config state, and rollback evidence before release completion.

## Phase 9D after Phase 9B

Implement security telemetry/browser hardening against the then-current production UI baseline.

Direction:

- reuse `audit_events` and `lib/audit/write-audit-event.ts` for durable workspace security-significant events
- use structured privacy-reduced server logs for high-frequency operational security signals
- never log passwords, tokens, API keys, credentials, cookies, authorization headers, worker lease tokens, source content, or raw executor output
- add tests around metadata safety and event-shape allowlists
- preserve the existing security header baseline
- stage CSP carefully and require actual current Next.js/WebGL UI compatibility evidence before enforcement
- do not ship a broad `unsafe-inline` CSP merely to claim CSP coverage
- do not couple security telemetry to visual components

## Phase 9E after Phase 9D

Complete incident and release readiness:

- private vulnerability disclosure workflow
- severity/triage procedure
- containment and worker-disable procedure
- credential rotation runbook
- Supabase/Vercel rollback procedures
- impact assessment and recovery checks
- post-incident validation
- final security release checklist and exact deployment evidence

## Outstanding database review item

Legacy broad SQL grants on `profiles`, `workspaces`, and `workspace_members` remain a separate review point. RLS is enabled and Phase 9C did not change these grants. Do not silently mix cleanup into Phase 9B/9D unless the reviewed design explicitly expands scope.

## Runtime authority

Keep false/absent until their own operational acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## UI baseline rule

The production `main` tree is authoritative. PR #49 remains an open draft legacy UI branch and must remain untouched unless separately requested. Security changes should integrate with the current production components, styles, routes, and WebGL behavior instead of attempting to restore or reconcile the old UI branch.
