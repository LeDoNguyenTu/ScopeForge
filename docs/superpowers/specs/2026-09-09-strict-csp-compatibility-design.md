# Strict CSP Compatibility Design

Date: 2026-09-09
Status: approved design, implementation pending
Repository: `LeDoNguyenTu/ScopeForge`
Baseline main: `b859218d72b4ca7f98a9b91f6d3b4db47541b9bc`
Working branch: `feat/strict-csp-compatibility-v1`

## Objective

Enforce a strict production Content Security Policy for the current ScopeForge Next.js 15.5.24 application without weakening the accepted Command Center UI V5, authentication flows, Supabase browser connectivity, WebGL rendering, or current security-header baseline.

This gate is intentionally separate from the completed Phase 9 release. CSP is not considered complete until exact-head preview and production evidence prove that the enforced policy does not break required behavior.

## Non-goals

This work does not:

- change the accepted Command Center UI V5 composition or visual direction
- enable any hosted repository snapshot, scan, passive worker, or active CORS runtime capability
- change scanner authority or execution semantics
- add database migrations or change Supabase grants/RLS
- activate or claim external Turnstile, Vercel WAF, or other provider controls without direct evidence
- introduce wildcard third-party origins
- add a permanent production `unsafe-eval`
- add a broad permanent production `unsafe-inline` merely to silence CSP errors
- add speculative WebSocket or provider origins

## Framework evidence

ScopeForge currently uses Next.js `15.5.24` with App Router.

The current Next.js CSP guidance requires a fresh unpredictable nonce per request for nonce-based strict CSP and explains that nonce use requires dynamic rendering because static pages have no request-time nonce. When the CSP nonce is present on the request, Next.js automatically applies that nonce to framework scripts, page JavaScript bundles, and inline framework-generated scripts/styles. Production does not require `unsafe-eval`; development may require it for React debugging.

The implementation therefore uses the framework-supported request nonce model rather than a copied static header template.

## Current compatibility blockers

### Framework bootstrap scripts

Current production HTML contains Next.js framework scripts and inline RSC/hydration bootstrap scripts. A static `script-src 'self'` policy without a nonce would block application hydration.

### Active inline style attributes

The current application contains legitimate React `style` props in active rendering paths, including:

- the Command Center V5 scene poster layer
- landing boot progress
- dashboard progress/coverage rendering
- the Turnstile container

Historical or inactive visual components also contain inline styles. They are not modified unless import/runtime analysis proves they are reachable from an accepted production path.

A strict style policy must not be weakened globally to preserve these attributes. Active blockers are migrated to stylesheet-based classes or semantic elements before enforcement.

### Default 404 rendering

The current framework fallback 404 output can contain framework-provided inline styles. ScopeForge will provide an application-owned `app/not-found.tsx` so the known 404 path follows the same CSP-compatible styling model as the rest of the site.

### Supabase browser connectivity

Browser Supabase requests use the exact origin derived from `NEXT_PUBLIC_SUPABASE_URL`. The CSP must allow that configured HTTPS origin in `connect-src` and must not add unrelated Supabase or WebSocket origins.

### Cloudflare Turnstile

When `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is configured, the current client loads the official Turnstile script from `https://challenges.cloudflare.com` and creates the provider frame. CSP support for Turnstile is therefore conditional and limited to the exact required script/frame origin.

Provider enforcement remains a separate truth claim. Allowing the provider origin in CSP does not prove Turnstile is configured in production.

## Architecture

### 1. Central CSP policy builder

Add a dedicated server-safe CSP module, expected at `lib/security/csp.ts`, responsible for:

- generating a cryptographically unpredictable nonce
- normalizing configured browser origins
- constructing the complete policy from explicit directives
- distinguishing development-only allowances from production policy
- conditionally adding Turnstile origins only when the public site key is configured
- returning a compact single-line header value

The policy builder must reject or omit malformed configured origins rather than broadening the policy.

The module must be deterministic given its nonce, environment, and configured origins so unit tests can assert exact directives.

### 2. Middleware and Supabase session integration

The existing `middleware.ts` delegates to `lib/supabase/middleware.ts`, and that session helper may recreate `NextResponse` when Supabase auth cookies are refreshed.

The CSP integration must therefore be part of the middleware/session response contract.

Flow:

1. Generate a fresh nonce for the incoming document request.
2. Build the CSP from that nonce and the configured browser origins.
3. Clone the incoming request headers.
4. Set `x-nonce` and `Content-Security-Policy` on the request header set passed into Next.js rendering.
5. Call the Supabase session helper with those modified request headers.
6. Ensure every response construction path in the session helper preserves those request headers.
7. Apply the same CSP to the final response header.
8. Preserve existing Supabase cookie refresh behavior exactly.

This is necessary because applying CSP only after `updateSession()` would not allow Next.js to discover the nonce during rendering.

### 3. Request matching

CSP nonce middleware applies to rendered application document routes and excludes static resources that do not need request-time nonces.

The matcher continues to exclude at least:

- `/_next/static`
- `/_next/image`
- favicon/static image resources already excluded by the current matcher

Prefetch requests should be excluded when doing so is compatible with the current Next.js 15 middleware configuration, following the framework guidance. API/worker route behavior must not be changed merely to attach a browser CSP header.

### 4. Target production policy

The initial production policy is based on observed application requirements and should contain the following properties:

- `default-src 'self'`
- `script-src 'self' 'nonce-<request-nonce>' 'strict-dynamic'` plus the exact Turnstile origin only when configured
- no production `unsafe-eval`
- no production script `unsafe-inline`
- `style-src 'self' 'nonce-<request-nonce>'`
- no broad permanent style `unsafe-inline`
- `img-src 'self' data: blob:` only where validated as required by the current rendered application
- `font-src 'self'`
- `connect-src 'self'` plus the exact configured ScopeForge Supabase HTTPS origin
- `frame-src` limited to `https://challenges.cloudflare.com` only when Turnstile is configured, otherwise no external frame source
- `object-src 'none'`
- `base-uri 'self'`
- `form-action 'self'`
- `frame-ancestors 'none'`
- `upgrade-insecure-requests` in production where it does not interfere with local development

Development may include only the framework-required debugging allowance, such as `unsafe-eval`, and that allowance must be structurally impossible to appear in a production-policy test.

The final directive list may become narrower after implementation evidence. It must not become broader without a documented observed requirement and regression coverage.

### 5. Active inline-style migration

Only active production blockers are refactored.

Expected changes include:

- `components/landing/AttackSurfaceSceneV5.tsx`: move the poster layer's fixed positioning/object-fit properties to the existing V5 stylesheet
- `components/landing/ScopeForgeBootScreen.tsx`: replace inline percentage width with a CSP-safe semantic progress implementation or class/data-state design that preserves the same visual behavior
- `components/dashboard/ImmersiveDashboardExperience.tsx`: remove dynamic inline width styles from progress/coverage rendering using a CSP-compatible semantic progress or bounded class/data representation
- `components/auth/TurnstileChallenge.tsx`: move static flex/layout styles to the existing auth stylesheet
- any additional style attribute found on a production-reachable path by implementation-time search

The implementation must preserve visual output and accessibility semantics. It must not redesign V5.

Historical components that are not reachable from the accepted production path are left unchanged unless tests prove the CSP policy still executes them.

### 6. Application-owned not-found page

Add `app/not-found.tsx` using existing ScopeForge design primitives and stylesheet classes only.

It must:

- contain no React inline styles
- avoid raw inline script/style tags
- provide a clear return path to the public home page
- preserve accessibility and normal Next.js not-found semantics

### 7. Third-party script nonce handling

The existing Turnstile component uses `next/script`.

If the current Next.js automatic nonce propagation does not cover this client `Script` path in the exact preview build, the nonce must be explicitly passed from a server boundary to the component and provided through the `nonce` prop. The implementation should prefer the least invasive framework-supported mechanism demonstrated by preview evidence.

No third-party script may be exempted with a generic unsafe directive.

## Rendering and caching tradeoff

Per-request nonce CSP requires dynamic rendering for affected HTML. This intentionally changes document rendering/cache behavior compared with the current fully prerendered landing/auth HTML.

Static JavaScript, CSS, images, posters, and other immutable assets remain cacheable independently.

This tradeoff is accepted because it provides framework-supported strict script execution control. A brittle build-time hash inventory or a permanent unsafe directive is not preferred solely to retain static HTML caching.

Performance must still be checked in preview and production. Any severe regression is a release blocker and triggers design re-evaluation rather than silent policy weakening.

## Testing strategy

Implementation follows TDD.

### Policy unit tests

Add focused tests for the policy builder covering:

- unique/non-empty nonce generation contract
- exact production directives
- production excludes `unsafe-eval`
- production excludes script/style `unsafe-inline`
- no wildcard source
- exact Supabase origin parsing
- malformed Supabase origin fails closed or is omitted according to the documented policy contract
- Turnstile origin absent when unconfigured
- Turnstile script/frame origin present only when configured
- development-only debugging allowance cannot leak into production

### Middleware regression tests

Tests must verify:

- request receives `x-nonce`
- request receives CSP before rendering/session handling
- response receives the same policy
- response nonce and CSP nonce match
- Supabase cookie refresh response recreation preserves request headers and final CSP
- excluded static paths do not receive unnecessary nonce handling
- existing middleware auth/session semantics remain unchanged

### Source architecture guards

Add repository guards for production-reachable CSP blockers, including:

- no inline style attributes in the explicitly covered active CSP migration files
- no production CSP containing wildcard origins
- no production CSP containing `unsafe-eval`
- no production script/style `unsafe-inline`
- no accidental removal of the existing security-header baseline

A global ban on every historical `style={{` occurrence is not required unless import analysis proves every matching component is production reachable.

### Existing application tests

All existing tests must remain green. V5 component/rendering tests and auth tests are release blockers.

## Preview acceptance

Before merge, freeze one exact candidate SHA and require:

- full repository CI on that exact SHA
- Vercel Preview READY for that exact SHA
- HTTP 200 for the public landing page
- CSP header present on rendered document responses
- nonce present in CSP and rendered Next.js framework scripts
- production-form policy contains no `unsafe-eval`
- no script/style broad `unsafe-inline`
- existing HSTS, nosniff, frame, referrer, permissions headers preserved
- desktop and mobile V5 markers present
- desktop and mobile V5 poster assets still load
- sign-in and sign-up render
- custom 404 renders
- dashboard path preserves expected auth behavior
- Turnstile-configured preview verification if a site key is available in the preview environment
- no required browser request blocked by CSP
- no Next.js error overlay, hydration failure, blank page, or WebGL regression

Where browser automation is available, inspect browser console CSP violations directly. If the connected environment cannot run a real browser, lack of browser evidence must be stated explicitly and enforcement must not be represented as fully accepted until an equivalent browser gate is completed.

## Production release gate

Merge only when the exact PR head is mergeable and all required candidate gates are green.

After merge:

- independently run/verify main CI on the merge SHA
- verify the exact production Vercel deployment is READY
- fetch `https://scopeforge.dev` and relevant auth routes
- confirm the enforced CSP header is present
- confirm the policy contains the expected nonce model and no forbidden production allowances
- confirm V5 desktop/mobile markers and poster assets remain live
- confirm existing security headers remain present
- confirm Supabase Security Advisor has no new regression caused by this work
- confirm the four hosted runtime capability flags remain false/absent
- record exact candidate, merge, CI, deployment, and CSP evidence in release-state documentation

## Rollback

Rollback is an application deployment rollback to the last known-good pre-CSP release if the enforced policy causes production rendering, authentication, dashboard, WebGL, or provider failures.

Do not respond to a compatibility incident by broadening the production CSP with permanent `unsafe-inline`, `unsafe-eval`, or wildcard origins unless a separately reviewed design explicitly proves that change is necessary and proportionate.

The previous known-good application baseline before this gate is `b859218d72b4ca7f98a9b91f6d3b4db47541b9bc`, whose executable Phase 9E release parent is `6c6c07b070d2751a96729d3e58a86414ae148edc`.

## Acceptance definition

This gate is complete only when all of the following are true:

1. nonce CSP is enforced on production document responses
2. production scripts run without script `unsafe-inline` or `unsafe-eval`
3. active production style attributes that conflict with the strict policy are removed or replaced without visual regressions
4. Supabase browser connectivity remains functional under the exact configured origin policy
5. Turnstile remains CSP-compatible when configured without widening unrelated origins
6. V5 desktop/mobile rendering and WebGL behavior remain intact
7. auth, dashboard, not-found, navigation, and existing security headers remain intact
8. exact candidate CI/Preview and post-merge main/production evidence are recorded
9. provider truth remains conservative and no runtime capability is silently enabled
