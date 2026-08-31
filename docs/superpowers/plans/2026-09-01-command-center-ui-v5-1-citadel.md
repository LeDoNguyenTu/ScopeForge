# Command Center UI V5.1 Citadel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simplified V5 landing scene with a dense, desktop-first procedural Three.js security citadel and scale the dashboard typography/icons to product-grade readability.

**Architecture:** Keep the existing V5 presentation boundary and responsive desktop/mobile composition, but replace the scene internals with a layered citadel built from reusable procedural modules and instanced detail. Upgrade adaptive quality, lighting, motion, and UI scale without changing backend/security authority.

**Tech Stack:** Next.js 15, React 19, TypeScript, Three.js 0.180, Vitest, CSS.

**Spec:** `docs/superpowers/specs/2026-09-01-command-center-ui-v5-1-citadel-design.md`

## Global Constraints
- Three.js remains the only runtime rendering dependency.
- Palette is limited to the graphite/slate + teal/cyan + orange/amber + off-white/muted-grey values in the spec.
- Presentation-only: no Supabase, Phase 6D, scanner, worker authority, Turnstile, or hosted-runtime behavior changes.
- Desktop is the primary visual target; mobile remains sharp/readable with a separate camera/composition.
- PR #49 remains draft until user approves the V5.1 preview.

---

### Task 1: Lock scene budgets and adaptive quality

**Files:**
- Modify: `components/landing/attack-surface-v5/quality.ts`
- Modify: `components/landing/attack-surface-v5/materials.ts`
- Test: `tests/components/attack-surface-v5-quality.test.ts`

**Interfaces:**
- Produces `AttackSurfaceV5QualitySettings` with DPR/detail/particle budgets consumed by geometry and controller.
- Produces reusable Citadel materials for structure, glass, teal/cyan healthy energy, orange/amber risk energy, and holographic wire detail.

- [ ] **Step 1: Write failing assertions for V5.1 DPR/detail budgets.**
  - Cinematic DPR cap must equal 2.5.
  - Balanced DPR cap must equal 2.0.
  - Constrained/reduced DPR cap must equal 1.5.
  - A 430px DPR-3 8GB phone remains balanced.
  - Settings expose `detailFactor`, `particleFactor`, and `hologramFactor` with cinematic > balanced > constrained.

- [ ] **Step 2: Run `NODE_ENV=test npx vitest run tests/components/attack-surface-v5-quality.test.ts` and verify RED.**

- [ ] **Step 3: Implement quality budgets and Citadel material set.**
  - Preserve antialias/bloom downgrade order.
  - Use the exact spec palette.
  - Reuse materials rather than constructing one per mesh.

- [ ] **Step 4: Rerun focused test and verify GREEN.**

- [ ] **Step 5: Commit `feat: raise v5.1 render quality budgets [skip ci]`.**

### Task 2: Rebuild geometry as a dense Citadel

**Files:**
- Rewrite: `components/landing/attack-surface-v5/geometry.ts`
- Create: `components/landing/attack-surface-v5/citadel-core.ts`
- Create: `components/landing/attack-surface-v5/citadel-arm.ts`
- Create: `components/landing/attack-surface-v5/citadel-compound.ts`
- Test: `tests/components/attack-surface-v5-geometry.test.ts`

**Interfaces:**
- `createCitadelCore(materials, quality)` returns a named `THREE.Group` containing core rings/decks/crown and registers animated ring/core objects in `userData`.
- `createCitadelArm(entity, index, count, materials, quality)` returns one segmented arm with routed curve and pulse/scan handles.
- `createCitadelCompound(entity, index, endpoint, angle, materials, quality)` returns the endpoint compound.
- `createAttackSurfaceV5Group(model, quality)` assembles all modules.

- [ ] **Step 1: Expand geometry tests to require:**
  - `coreRingCount >= 8`.
  - `coreDeckCount >= 4`.
  - six arms.
  - `bridgeSegmentCount >= 18` total.
  - `compoundModuleCount >= 24` total.
  - balanced scene mesh count > 90.
  - named energy core and all six endpoint compounds.

- [ ] **Step 2: Run focused geometry test and verify RED.**

- [ ] **Step 3: Implement `citadel-core.ts`.**
  - Four stacked cylinder/deck levels.
  - Eight+ torus/ring elements with alternating structure/wire/energy materials.
  - Raised crown, radial brace spokes, lower underside mass, energy chamber and halo stack.
  - Register ring arrays and energy objects in `userData`.

- [ ] **Step 4: Implement `citadel-compound.ts`.**
  - Base platform + main tower + two satellite modules + cage/antenna/scan plane at balanced/cinematic quality.
  - Risk endpoints use orange/amber emphasis; healthy endpoints use teal/cyan.
  - Vary height/silhouette deterministically by index.

- [ ] **Step 5: Implement `citadel-arm.ts`.**
  - Three bridge segments per arm.
  - Twin rails, truss braces, underside supports, routed tube path, pulse packet, scan marker.
  - Secondary braces omitted only at constrained/reduced quality.

- [ ] **Step 6: Rewrite assembler in `geometry.ts` and rerun focused test GREEN.**

- [ ] **Step 7: Commit `feat: rebuild v5.1 scene as dense citadel [skip ci]`.**

### Task 3: Add layered Citadel animation and atmosphere

**Files:**
- Rewrite: `components/landing/attack-surface-v5/animation.ts`
- Create: `components/landing/attack-surface-v5/atmosphere.ts`
- Modify: `components/landing/attack-surface-v5/lighting.ts`
- Modify: `components/landing/attack-surface-v5/effects.ts`
- Test: `tests/components/attack-surface-v5-animation.test.ts`

**Interfaces:**
- `createCitadelAtmosphere(quality, materials)` returns particle/spark groups and animation handles.
- `updateAttackSurfaceV5Animation(group, elapsed, pointer)` updates all registered animation channels without allocating new geometry per frame.

- [ ] **Step 1: Add tests proving at least six named animation channels are registered by the scene.**
  - ring rotation
  - core breathing
  - path packets
  - risk cascade
  - endpoint scan
  - atmospheric drift

- [ ] **Step 2: Run focused animation test and verify RED.**

- [ ] **Step 3: Implement atmosphere using `THREE.Points`/instancing with deterministic seeded positions.**

- [ ] **Step 4: Implement layered animation.**
  - Counter-rotating ring groups with distinct speeds.
  - Energy core scale/emissive breathing.
  - Multiple packets per path where quality permits.
  - Risk glow cascade based on curve progress.
  - Endpoint scan plane/antenna oscillation.
  - Particle drift and subtle scene float.
  - Pointer parallax uses eased camera/scene inertia.

- [ ] **Step 5: Upgrade lighting/effects with stronger depth, restrained fog, teal rim and orange risk light, quality-scaled bloom.**

- [ ] **Step 6: Rerun focused animation test GREEN.**

- [ ] **Step 7: Commit `feat: add layered citadel motion and atmosphere [skip ci]`.**

### Task 4: Upgrade controller and camera for desktop-first cinematic rendering

**Files:**
- Modify: `components/landing/attack-surface-v5/controller.ts`
- Modify: `components/landing/AttackSurfaceSceneV5.tsx`
- Test: `tests/components/attack-surface-v5-controller.test.ts`
- Test: `tests/components/AttackSurfaceSceneV5.test.tsx`

**Interfaces:**
- Preserve existing controller API.
- Desktop/mobile camera configuration remains variant-driven.

- [ ] **Step 1: Add assertions for V5.1 camera and lifecycle contracts.**
  - Desktop and mobile variants use distinct camera presets.
  - Renderer DPR is bounded by V5.1 quality settings.
  - Disposal remains idempotent and releases shared unique geometry/material resources once.
  - Inactive breakpoint does not initialize WebGL.

- [ ] **Step 2: Run focused controller/scene tests RED if required.**

- [ ] **Step 3: Implement lower, wider desktop camera with visible underside depth and a tighter mobile camera that keeps all endpoints in frame.**

- [ ] **Step 4: Preserve offscreen/document pause, reduced-motion static frame, stable-frame boot handoff, and global pause control.**

- [ ] **Step 5: Rerun focused tests GREEN.**

- [ ] **Step 6: Commit `feat: tune v5.1 cinematic cameras [skip ci]`.**

### Task 5: Fix typography, icon scale, telemetry density, and responsive layout

**Files:**
- Modify: `components/landing/CommandCenterV5Primitives.tsx`
- Modify: `app/command-center-v5.css`
- Test: `tests/components/CommandCenterLandingHero.test.tsx`
- Create: `tests/landing/command-center-v5-1-scale-contract.test.ts`

**Interfaces:**
- Existing semantic content/links remain unchanged.
- New scale-contract test reads CSS and guards minimum font/icon sizes.

- [ ] **Step 1: Add scale-contract assertions for the spec minimums.**
  - Desktop metric values >= 32px; mobile >= 34px.
  - Metric labels desktop >= 13px; mobile >= 14px.
  - Metric icons >= 24px.
  - Mobile supporting copy >= 12px.
  - Runtime/overview/risk-path text >= spec minimums.

- [ ] **Step 2: Run scale contract and verify RED.**

- [ ] **Step 3: Increase Lucide icon sizes in primitives to 24-28px where appropriate.**

- [ ] **Step 4: Rewrite V5 telemetry sizing/layout CSS.**
  - Increase card heights before shrinking content.
  - Desktop metrics remain compact but readable.
  - Mobile two-column grid remains only where minimums fit; otherwise stack/split intelligently at <=380px.
  - Increase overview and runtime readability.
  - Preserve palette and glass treatment.

- [ ] **Step 5: Increase scene label size and spacing without covering the Citadel silhouette.**

- [ ] **Step 6: Run focused hero + scale tests GREEN.**

- [ ] **Step 7: Commit `fix: raise v5.1 typography and icon scale [skip ci]`.**

### Task 6: Architecture and software verification

**Files:**
- Modify if needed: `tests/landing/command-center-v5-architecture.test.ts`
- Create: `docs/superpowers/reports/2026-09-01-command-center-v5-1-software-verification.md`

**Interfaces:** None beyond release evidence.

- [ ] **Step 1: Extend architecture guard to cover new Citadel modules and forbid Supabase/scanner/worker imports.**

- [ ] **Step 2: Run `NODE_ENV=test npm test`. Expected: all tests pass.**

- [ ] **Step 3: Run `npm run typecheck`. Expected: exit 0.**

- [ ] **Step 4: Run `npm run build:cli` and `node .scopeforge-build/packages/cli/index.js version`. Expected: `ScopeForge 0.1.0`.**

- [ ] **Step 5: Run `npm run benchmark:scanner`. Expected: under 20,000 ms budget.**

- [ ] **Step 6: Run `npm audit --audit-level=info`. Expected: 0 vulnerabilities.**

- [ ] **Step 7: Record exact results and candidate SHA in verification report.**

- [ ] **Step 8: Commit `test: verify command center v5.1 candidate [skip ci]`.**

### Task 7: Publish and inspect V5.1 preview

**Files:**
- Create after acceptance: `docs/superpowers/reports/2026-09-01-command-center-v5-1-visual-acceptance.md`
- Regenerate after scene approval: `public/landing/attack-surface-v5-desktop.webp`, `public/landing/attack-surface-v5-mobile.webp`

**Interfaces:** Preview-only branch; PR #49 remains draft.

- [ ] **Step 1: Publish Vercel preview from exact V5.1 candidate SHA using the existing isolated preview build override for missing public Supabase Preview variables.**

- [ ] **Step 2: Confirm Vercel state READY and production build completes all static routes.**

- [ ] **Step 3: Inspect 1440x900 and 1280x800 desktop states.**
  - Citadel density/industrial depth.
  - Complete radial silhouette.
  - typography/icon scale.
  - no overlap/clipping.
  - motion quality.

- [ ] **Step 4: Inspect 430x932 and 390x844 mobile states plus reduced motion.**

- [ ] **Step 5: Fix all observed visual defects and republish until clean.**

- [ ] **Step 6: Present preview to user. PR #49 remains draft.**

- [ ] **Step 7: Only after user approves the live Citadel scene, regenerate scene-derived WebP posters and record final visual acceptance evidence.**
