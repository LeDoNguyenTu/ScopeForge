# Strict CSP Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce a strict per-request nonce Content Security Policy on ScopeForge without changing the accepted Command Center UI V5, authentication semantics, Supabase authority, scanner behavior, database state, or hosted runtime capability state.

**Architecture:** Generate one fresh nonce and one policy per rendered document request in middleware, put both `x-nonce` and `Content-Security-Policy` on the request headers before Next.js renders, preserve those request headers through Supabase session response recreation, and emit the same CSP on the final response. Remove the small set of active React inline-style attributes that conflict with a strict style policy and replace the framework fallback 404 with an application-owned page. Keep the existing `next.config.ts` browser-header baseline unchanged.

**Tech Stack:** Next.js 15.5.24 App Router, React 19, TypeScript, Vitest/jsdom, Supabase SSR, Vercel, Cloudflare Turnstile.

**Spec:** `docs/superpowers/specs/2026-09-09-strict-csp-compatibility-design.md`

## Global Constraints

- Base is exact `main` `b859218d72b4ca7f98a9b91f6d3b4db47541b9bc`.
- Preserve the accepted Command Center V5 composition, posters, Three.js behavior, and desktop/mobile split.
- Do not add dependencies, Supabase migrations, RLS changes, scanner changes, worker changes, or provider activation.
- Keep all four hosted runtime capability flags false or absent unless separately authorized.
- Production CSP must not contain script/style `unsafe-inline`, `unsafe-eval`, wildcard source origins, or speculative WebSocket origins.
- Development may use only the framework-required `unsafe-eval` debugging allowance.
- Turnstile origin allowances are conditional on the public site key and do not constitute evidence of provider enforcement.
- Intermediate implementation commits use `[skip ci]` except deliberate RED/GREEN verification commits. Exact candidate validation and post-merge `main` require substantive CI.
- Branch cleanup requires real ref deletion. Do not move old refs to `main` to simulate deletion.

---

### Task 1: Establish the RED CSP contract before production code

**Files:**
- Create: `tests/security/csp.test.ts`
- Create: `tests/architecture/strict-csp-compatibility.test.ts`
- Create: `tests/security/csp-middleware.test.ts`

**Interfaces:**
- Future module: `lib/security/csp.ts`
- Existing middleware: `middleware.ts`
- Existing session boundary: `lib/supabase/middleware.ts`
- Active presentation files listed in the approved spec.

- [ ] Create a CSP policy test that first asserts `lib/security/csp.ts` exists, then dynamically imports it and verifies nonce generation, production directives, exact Supabase origin handling, conditional Turnstile origin handling, development-only `unsafe-eval`, no production `unsafe-inline`, and no wildcard source.
- [ ] Create a source architecture guard asserting the four active CSP-migration component files contain no `style={{`, `app/not-found.tsx` exists without inline styles or raw inline script/style markup, middleware contains the request nonce/CSP integration, and the existing `next.config.ts` header baseline remains intact.
- [ ] Create a middleware/session regression test using Vitest mocks for `NextResponse.next` and `@supabase/ssr` so a simulated Supabase cookie refresh proves the modified request headers survive every response recreation.
- [ ] Commit only tests with a non-`[skip ci]` message.
- [ ] Open a non-draft PR so repository CI runs on the tests-only head.
- [ ] Verify RED is caused by the missing CSP implementation/current inline-style blockers, not by a broken test harness.

Expected RED: CSP builder absent, middleware has no nonce policy integration, active style guards fail, and custom 404 is absent.

---

### Task 2: Implement the central CSP policy builder

**Files:**
- Create: `lib/security/csp.ts`

**Required API:**

```ts
export type CspEnvironment = "development" | "production" | "test";

export type BuildCspOptions = Readonly<{
  nonce: string;
  environment: CspEnvironment;
  supabaseUrl?: string | null;
  turnstileSiteKey?: string | null;
}>;

export function createCspNonce(): string;
export function normalizeBrowserOrigin(raw: string | null | undefined, environment: CspEnvironment): string | null;
export function buildCsp(options: BuildCspOptions): string;
```

- [ ] Generate a fresh unpredictable nonce with Web Crypto compatible with the middleware runtime. Use a nonce alphabet accepted by Next.js CSP parsing.
- [ ] Normalize configured browser origins with `URL`; permit HTTPS origins, and permit loopback HTTP only outside production. Reject credentials, non-HTTP(S) schemes, fragments, and malformed input.
- [ ] Build an explicit semicolon-delimited policy with `default-src`, `script-src`, `style-src`, `img-src`, `font-src`, `connect-src`, `frame-src`, `object-src`, `base-uri`, `form-action`, `frame-ancestors`, and production `upgrade-insecure-requests`.
- [ ] `script-src` contains `'self'`, the nonce, and `'strict-dynamic'`; add `'unsafe-eval'` only in development.
- [ ] `connect-src` adds only the normalized configured Supabase origin.
- [ ] Add `https://challenges.cloudflare.com` to Turnstile-required script/frame directives only when a non-empty site key is configured.
- [ ] Run the focused CSP test through CI after the implementation batch and ensure these assertions turn GREEN.

---

### Task 3: Integrate nonce CSP with middleware and preserve Supabase session headers

**Files:**
- Modify: `middleware.ts`
- Modify: `lib/supabase/middleware.ts`

- [ ] In middleware, generate the nonce and policy before session handling.
- [ ] Clone request headers and set `x-nonce` plus `Content-Security-Policy` before passing rendering onward.
- [ ] Change `updateSession` to accept the modified request headers and use `NextResponse.next({ request: { headers: requestHeaders } })` for both its initial response and every cookie-refresh response recreation.
- [ ] Set the same CSP value on the final response.
- [ ] Keep cookie mutation behavior unchanged.
- [ ] Update matcher to continue excluding static/image/favicon assets, exclude API routes from document nonce handling, and ignore Next.js prefetch requests using the documented `missing` matcher predicates.
- [ ] Do not add CSP to worker/API behavior solely for browser policy coverage.

Expected GREEN: middleware tests prove request nonce/CSP propagation, response CSP equality, and cookie-refresh preservation.

---

### Task 4: Remove active inline-style blockers without redesigning V5

**Files:**
- Modify: `components/landing/AttackSurfaceSceneV5.tsx`
- Modify: `app/command-center-v5.css`
- Modify: `components/landing/ScopeForgeBootScreen.tsx`
- Modify: `app/command-center-boot.css`
- Modify: `components/dashboard/ImmersiveDashboardExperience.tsx`
- Modify: `app/saas-dashboard.css`
- Modify: `components/auth/TurnstileChallenge.tsx`
- Modify: `app/globals.css`

- [ ] Move the V5 poster image fixed presentation properties into a dedicated V5 CSS class. Preserve poster source, visibility transitions, stacking, and object positioning.
- [ ] Replace the boot progress width style with a native `<progress>` element, preserving `aria-valuemin/max/now`, the displayed percentage, stage copy, and current visual gradient through browser progress pseudo-elements.
- [ ] Replace dashboard verification coverage width styling with a native `<progress>` element styled to match the existing track. Keep the existing visible percentage text.
- [ ] Move Turnstile container flex/layout properties into an auth CSS class. Do not change challenge behavior.
- [ ] Re-run existing V5 scene, boot gate, immersive dashboard, Turnstile, and AuthForm tests.
- [ ] Confirm the architecture guard finds no inline style in these four active files.

Historical unused visual components are not part of this cleanup unless new import evidence proves they are production reachable.

---

### Task 5: Add a CSP-compatible application 404

**Files:**
- Create: `app/not-found.tsx`
- Modify: `app/globals.css`

- [ ] Add a small application-owned `not-found` page using existing ScopeForge branding/layout classes.
- [ ] Include an accessible heading, explanatory copy, and return link to `/`.
- [ ] Use no React `style` prop, raw inline `<style>`, raw inline `<script>`, or `dangerouslySetInnerHTML`.
- [ ] Add CSS classes in the existing stylesheet only.
- [ ] Add/extend a focused test if needed to validate the rendered 404 semantics.

---

### Task 6: Reconcile historical security tests and run the GREEN gate

**Files:**
- Modify only if required: `tests/architecture/phase-9d-security-telemetry-browser-hardening.test.ts`
- Preserve: `tests/architecture/phase-9e-incident-release-engineering.test.ts`

- [ ] Keep the Phase 9D historical statement truthful: Phase 9D itself did not enforce CSP. Do not rewrite history merely because the later CSP gate now does.
- [ ] Keep the Phase 9E checklist phrase `CSP is not enforced by Phase 9E` so its historical architecture test remains correct.
- [ ] Run full repository validation on the exact implementation head through CI:

```bash
npm audit --audit-level=info
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run benchmark:matrix
npm run build
```

- [ ] Fix only real regressions within CSP scope. Do not weaken the CSP to silence unrelated failures.

---

### Task 7: Exact-head Vercel Preview and CSP acceptance

**Files:**
- Create/update before release freeze: `docs/development/STRICT_CSP_RELEASE_STATE.md`

- [ ] Freeze an exact candidate SHA and Git tree with no `[skip ci]` on the candidate validation commit if needed.
- [ ] Require exact candidate CI success.
- [ ] Require Vercel Preview READY for the same Git SHA.
- [ ] Fetch `/`, `/auth/sign-in`, `/auth/sign-up`, a nonexistent path, and the dashboard boundary.
- [ ] Verify the CSP response header contains a nonce and no production `unsafe-eval`/`unsafe-inline`.
- [ ] Verify rendered Next.js framework/inline bootstrap scripts carry the matching nonce.
- [ ] Verify existing HSTS, nosniff, DENY frame header, referrer policy, and permissions policy remain present.
- [ ] Verify desktop/mobile V5 markers and poster assets remain present.
- [ ] If a preview Turnstile site key is configured, verify its script receives/works with the nonce and only the documented Cloudflare origin is allowed.
- [ ] Run a real browser check for hydration, navigation, console CSP violations, auth rendering, custom 404, dashboard auth boundary, and WebGL/V5 behavior if a supported browser surface is available.
- [ ] If real browser execution is unavailable, record that limitation as a release blocker under the approved design rather than claiming complete acceptance.

---

### Task 8: Merge, independently verify production, and reconcile docs

**Files:**
- Finalize: `docs/development/STRICT_CSP_RELEASE_STATE.md`
- Follow-up docs after release: `docs/development/CURRENT_STATE.md`, `docs/development/NEXT_STEPS.md`, `docs/PHASES.md` if needed.

- [ ] Review full base-to-head diff and ensure no dependency, database, runtime-authority, scanner, provider-activation, or V5 redesign drift.
- [ ] Require mergeable PR, no unresolved review threads, no requested changes, and exact expected-head SHA.
- [ ] Merge only if every approved release blocker, including browser compatibility evidence, is clear.
- [ ] Verify independent `main` CI on the merge SHA.
- [ ] Verify production Vercel deployment READY on that exact merge SHA.
- [ ] Fetch `scopeforge.dev` and auth/404 routes and confirm enforced CSP plus all existing browser headers.
- [ ] Confirm V5 desktop/mobile markers and poster assets remain live.
- [ ] Recheck Supabase Security Advisor for no new CSP-related regression and keep leaked-password protection/provider truth explicit.
- [ ] Reconfirm all four hosted runtime flags remain false or absent.
- [ ] Record exact candidate SHA/tree, CI, preview deployment, merge SHA/tree, main CI, production deployment, CSP evidence, rollback target, and any provider items still NOT VERIFIED.
- [ ] Reconcile current-state/next-steps docs without falsely claiming stale branch cleanup is complete.

## Rollback

Known-good pre-CSP repository baseline: `b859218d72b4ca7f98a9b91f6d3b4db47541b9bc`.

Known-good executable Phase 9E production parent: `6c6c07b070d2751a96729d3e58a86414ae148edc` with deployment `dpl_5sQid6VJ4xC2BS7iYrHBYUrzzQFP`.

If CSP causes production rendering, hydration, auth, dashboard, WebGL, or Turnstile breakage, roll back to the known-good deployment. Do not permanently add `unsafe-inline`, `unsafe-eval`, or wildcard sources as an emergency compatibility shortcut.
