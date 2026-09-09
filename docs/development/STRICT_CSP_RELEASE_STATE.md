# Strict CSP Release State

Status: VALIDATION IN PROGRESS

Date: 2026-09-09

## Scope

This release gate introduces a strict per-request nonce Content Security Policy for rendered ScopeForge documents without changing the accepted Command Center V5 design, database schema, scanner behavior, hosted runtime authority, or provider activation state.

## Implementation checkpoint

- Implementation branch: `feat/strict-csp-compatibility-v1`
- Implementation parent before this release-state checkpoint: `485caf6661c3bb7a91e26c7397212c424afe05e1`
- Implementation tree before this release-state checkpoint: `c5327f151f70a887da47d1941b76b574dec143db`
- Pull request: #66
- TDD RED evidence: GitHub CI run #784 failed only in the new CSP suites while 351 existing test files and 1545 existing tests passed.
- Production CSP forbids `unsafe-inline`, production `unsafe-eval`, and wildcard source origins.
- Development keeps only the framework-required `unsafe-eval` allowance.
- Supabase browser connectivity is restricted to the normalized configured project origin.
- Turnstile allowances remain conditional on a configured public site key and do not prove provider enforcement.
- Middleware forwards the nonce and policy into Next.js rendering and preserves those headers through Supabase session-response recreation.
- Active React inline-style blockers were removed from the approved migration surface without redesigning V5.
- ScopeForge now owns the application 404 route.

## Exact-head gates still required

Before merge, record fresh evidence for all of the following on one exact candidate SHA:

1. GitHub CI success for audit, full tests, typecheck, CLI build/version, scanner benchmark, benchmark matrix, and production Next.js build.
2. Vercel Preview READY for the same candidate SHA.
3. Preview response verification for `/`, `/auth/sign-in`, `/auth/sign-up`, a nonexistent route, and the dashboard boundary.
4. Enforced CSP header with a request nonce and no production `unsafe-inline` or `unsafe-eval`.
5. Existing HSTS, nosniff, DENY frame header, referrer policy, and permissions policy preserved.
6. Command Center V5 desktop/mobile markers and poster assets preserved.
7. Real browser hydration/navigation/CSP-console/auth/404/dashboard/WebGL checks when a supported browser execution surface is available.
8. Full PR diff, review, mergeability, and scope-drift review.

## Operational truth retained

- CSP compatibility work does not activate hosted repository snapshot, repository scan, passive runtime, or active CORS worker capabilities.
- CSP compatibility work does not change Supabase schema or RLS.
- CSP compatibility work does not change dependency versions.
- Turnstile provider enforcement remains a separate operational fact from code compatibility.
- Vercel custom WAF/rate-limit provider state remains separate from this repository CSP gate.
- Historical stale branch cleanup remains incomplete until a real Git ref deletion capability is available. No branch will be repointed to simulate deletion.

## Rollback

Known-good pre-CSP repository baseline: `b859218d72b4ca7f98a9b91f6d3b4db47541b9bc`.

Known-good executable Phase 9E production parent: `6c6c07b070d2751a96729d3e58a86414ae148edc`, production deployment `dpl_5sQid6VJ4xC2BS7iYrHBYUrzzQFP`.

If strict CSP breaks rendering, hydration, authentication, dashboard behavior, WebGL/V5, or Turnstile, roll back to the known-good production deployment. Do not permanently weaken the policy with `unsafe-inline`, production `unsafe-eval`, or wildcard sources.
