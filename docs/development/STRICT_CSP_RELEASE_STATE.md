# Strict CSP Release State

Status: VALIDATION IN PROGRESS

Date: 2026-09-09

## Scope

This release gate introduces a strict per-request nonce Content Security Policy for rendered ScopeForge documents without changing the accepted Command Center V5 design, database schema, scanner behavior, hosted runtime authority, or provider activation state.

## Implementation checkpoint

- Implementation branch: `feat/strict-csp-compatibility-v1`
- Pull request: #66
- TDD RED evidence includes CI run #784 for the initial CSP contract and CI run #789 for the dynamic-rendering regression.
- CI run #789 proved the dynamic-rendering test RED in isolation: 1 new architecture test failed while the other 353 test files and 1558 tests passed, and `npm audit` reported 0 vulnerabilities.
- Root layout now calls Next.js `connection()` so nonce-bearing document requests are server-rendered on demand instead of prerendered without request headers.
- Production CSP forbids `unsafe-inline`, production `unsafe-eval`, and wildcard source origins.
- Development keeps only the framework-required `unsafe-eval` allowance.
- Supabase browser connectivity is restricted to the normalized configured project origin.
- Turnstile allowances remain conditional on a configured public site key and do not prove provider enforcement.
- Middleware forwards the nonce and policy into Next.js rendering and preserves those headers through Supabase session-response recreation.
- Active React inline-style blockers were removed from the approved migration surface without redesigning V5.
- ScopeForge now owns the application 404 route.

## Preview evidence after dynamic-rendering fix

Implementation commit `f2787cf6b74b030afa4caf0d02b10bd793d87245` deployed READY as Vercel Preview `dpl_79VHU4SfyaqGXyzaaUaETjVphui7`.

The build identified `/`, `/_not-found`, `/auth/sign-in`, `/auth/sign-up`, `/dashboard`, and the other rendered application routes as dynamic server-rendered routes. Only `manifest.webmanifest` remained static.

A fresh root response from the exact preview returned HTTP 200 and demonstrated the intended nonce contract end to end:

- response CSP carried a fresh request nonce;
- the same nonce appeared on Next.js stylesheet links, script preloads, framework chunks, page scripts, and inline bootstrap scripts;
- cache control was private/no-store and `x-vercel-cache` was `MISS`;
- the previous `x-nextjs-prerender: 1` condition was absent;
- CSP contained no `unsafe-inline` and no production `unsafe-eval`;
- HSTS, `nosniff`, `X-Frame-Options: DENY`, strict-origin referrer policy, and restrictive Permissions Policy remained present;
- Command Center V5 desktop and mobile test markers remained present;
- both Command Center V5 poster assets remained present.

Preview deployment protection currently intercepts direct deep-link requests to protected Preview URLs before the application, so `/auth/sign-in`, `/auth/sign-up`, a nonexistent path, and `/dashboard` cannot yet be counted as application-level deep-link evidence from the current connector. The local execution environment also lacks external DNS resolution, so it is not a substitute browser surface.

## Exact-head gates still required

Before merge, record fresh evidence for all of the following on one exact candidate SHA:

1. GitHub CI success for audit, full tests, typecheck, CLI build/version, scanner benchmark, benchmark matrix, and production Next.js build.
2. Vercel Preview READY for the same candidate SHA or an application-identical candidate whose only difference is this release-state evidence file.
3. Enforced CSP header with a request nonce and no production `unsafe-inline` or `unsafe-eval`.
4. Existing HSTS, nosniff, DENY frame header, referrer policy, and permissions policy preserved.
5. Command Center V5 desktop/mobile markers and poster assets preserved.
6. Deep-link verification for auth, application 404, and dashboard boundary when deployment protection permits application-level requests.
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
