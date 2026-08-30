# Exact Command Center UI v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ScopeForge public first viewport closely match the approved 1536 x 864 command-center render while preserving the existing security architecture and browser identity.

**Architecture:** Keep the public navigation, hero composition, telemetry presentation, and animated attack-surface renderer as focused presentation components. The centerpiece uses dependency-free raw WebGL with a DOM/SVG fallback, reduced-motion handling, bounded DPR, pointer-responsive camera drift, and no access to application security authority or workspace data. Existing authenticated dashboard, Supabase, worker, runtime-network, and scanner boundaries remain unchanged.

**Tech Stack:** Next.js 15.5.24, React 19.1, TypeScript 5.8, raw WebGL 1, CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-30-living-attack-surface-webgl-v2-design.md` plus the user-approved command-center render supplied on 2026-08-30.

## Global Constraints

- Do not use or depend on GitHub Actions.
- Every commit must include `[skip ci]`.
- Do not change migrations, RLS, Supabase authorization, runtime-network contracts, worker authority, Phase 6D gates, or hosted repository runtime gates.
- Do not add a graphics dependency solely for presentation.
- Keep fake public marketing telemetry clearly illustrative and separate from authenticated workspace data.
- Preserve `/scopeforge-mark-v2.svg`, manifest metadata, and the mobile Safari browser identity fix.
- Preserve reduced-motion and WebGL-unavailable fallbacks.

---

### Task 1: Lock the approved visual contract

**Files:**
- Test: `tests/components/CommandCenterLandingHero.test.tsx`
- Test: `tests/components/CommandCenterSurface.test.tsx`

**Interfaces:**
- Consumes: public landing component exports.
- Produces: regression expectations for the approved copy, telemetry labels, security-domain labels, fallback behavior, and dimensional renderer marker.

- [x] Add assertions for `LIVING ATTACK SURFACE`, the approved headline, CTA copy, attack-surface overview, runtime status, and illustrative telemetry labelling.
- [x] Add assertions for WEB APPLICATION, DATA STORE, IDENTITY, THIRD PARTY, SANDBOX, fallback status, and `data-scene-depth="3d"`.
- [x] Verify focused tests reach the intended RED state before the corresponding implementation.

### Task 2: Match the floating command-center navigation

**Files:**
- Modify: `components/landing/PublicNav.tsx`
- Modify: `app/exact-command-center.css`

**Interfaces:**
- Produces: capsule navigation with ScopeForge identity, Platform, Use Cases, Resources, Pricing, Company, Sign in, Request access, and mobile menu.

- [x] Recompose the desktop nav to match the approved rounded glass capsule.
- [x] Keep mobile navigation compact and touch-safe.
- [x] Preserve valid sign-in and sign-up routes.

### Task 3: Recompose the exact first viewport

**Files:**
- Create: `components/landing/CommandCenterLandingHero.tsx`
- Modify: `app/page.tsx`
- Modify: `app/exact-command-center.css`

**Interfaces:**
- Consumes: `CommandCenterSurface`.
- Produces: one integrated first viewport containing editorial copy, CTAs, four metrics, Attack Surface Overview, and runtime strip.

- [x] Position the editorial copy on the left with the approved headline scale and teal incident emphasis.
- [x] Add four compact illustrative metric cards and mark the public telemetry as illustrative.
- [x] Add the lower Attack Surface Overview panel and top-risk-path presentation.
- [x] Add the lower-right runtime, sensors, coverage, and pause-monitoring strip.
- [x] Keep the existing workflow and security-model sections below the hero.

### Task 4: Build the dimensional cyber attack-surface renderer

**Files:**
- Create: `components/landing/CommandCenterSurface.tsx`
- Test: `tests/components/CommandCenterSurface.test.tsx`

**Interfaces:**
- Produces: `CommandCenterSurface(): JSX.Element`.

- [x] Create a WebGL canvas that remains decorative to assistive technology.
- [x] Build a perspective scene with layered hub rings, six mechanical truss arms, endpoint wireframe cubes/towers, telemetry particles, and risk/healthy color states.
- [x] Animate scan pulses along the arms and subtle camera drift.
- [x] Add pointer-responsive parallax without per-frame DOM layout reads.
- [x] Cap DPR for mobile Safari and pause requestAnimationFrame when hidden.
- [x] Respect `prefers-reduced-motion`.
- [x] Keep an SVG topology visible when WebGL is unavailable.
- [x] Keep security-domain labels in the DOM for readability and testing.

### Task 5: Preserve the composition on mobile

**Files:**
- Modify: `app/exact-command-center.css`

**Interfaces:**
- Consumes: the same hero and renderer components as desktop.
- Produces: mobile layout that remains visually continuous instead of pushing the main figure into an unrelated lower section.

- [x] Keep the hero, figure, runtime strip, and metrics in the same command-center section.
- [x] Scale and crop the scene intentionally for narrow screens.
- [x] Use a two-column metric grid and hide the dense overview panel where it would become unreadable.
- [x] Preserve touch-safe CTAs and mobile navigation.

### Task 6: Exact-head acceptance and production integration

**Files:**
- Modify: `package.json` only to restore the normal build command after temporary acceptance runs.
- Review: all files changed relative to `main`.

**Interfaces:**
- Produces: merge-ready PR with exact-head verification evidence.

- [ ] Run the complete Vitest suite on the exact final branch head.
- [ ] Run `npm run typecheck`.
- [ ] Build the CLI and verify `ScopeForge 0.1.0`.
- [ ] Run the scanner benchmark and confirm it remains within the 20,000 ms budget.
- [ ] Run `npm audit --audit-level=info` and require zero vulnerabilities.
- [ ] Run a production Next.js compilation/type-validation pass.
- [ ] Restore `package.json` build script to `next build` before merge.
- [ ] Compare the final branch against `main` and confirm there are no migrations, runtime-network, worker, RLS, authorization, or dependency additions.
- [ ] Open/review the PR and merge only if the reviewed head matches the verified head.
- [ ] Verify the resulting production deployment, `scopeforge.dev`, browser identity metadata, auth routes, runtime errors, and Supabase security advisor.
