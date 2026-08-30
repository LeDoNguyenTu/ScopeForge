# Living Attack Surface WebGL V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the conventional dashboard-home composition with the approved immersive Living Attack Surface command-center layout and an original raw-WebGL topology driven by real workspace data.

**Architecture:** Keep server-side Supabase querying in `app/dashboard/page.tsx`, convert rows into a small serializable topology model with a pure helper, and pass that model into a client-only WebGL renderer. Add an `immersive` AppShell variant only for dashboard home. The WebGL canvas is decorative and has DOM equivalents for all user-relevant state.

**Tech Stack:** Next.js 15, React 19, TypeScript, raw WebGL, CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-30-living-attack-surface-webgl-v2-design.md`

## Global Constraints

- Real workspace data only. No invented telemetry, sensors, risk paths, or exposure scores as live facts.
- No new graphics runtime dependency.
- No schema, RLS, migration, worker, network-authority, finding-persistence, or Phase 6D changes.
- Mobile Safari and reduced-motion fallbacks are required.
- Every repository commit includes `[skip ci]`.
- GitHub Actions are not used as verification evidence.

---

### Task 1: Safari site identity refresh

**Files:**
- Create: `public/scopeforge-mark-v2.svg`
- Create: `app/manifest.ts`
- Modify: `app/layout.tsx`
- Test: `tests/brand/browser-icons.test.ts`

**Interfaces:**
- Produces: dedicated `/scopeforge-mark-v2.svg` icon URL and installable manifest metadata.

- [x] **Step 1: Write the failing browser-icon regression test.**
- [x] **Step 2: Run the focused test and confirm failure against the old `/icon.svg` metadata.**
- [x] **Step 3: Add the versioned Forge Aperture icon, explicit metadata, and manifest.**
- [ ] **Step 4: Re-run focused tests and TypeScript verification on an independent verifier.**

### Task 2: Pure dashboard topology model

**Files:**
- Create: `lib/dashboard/attack-surface-model.ts`
- Test: `tests/dashboard/attack-surface-model.test.ts`

**Interfaces:**
- Consumes: asset rows `{ id, kind, name, canonical_target, verification_status, created_at }` and active finding rows `{ asset_id, severity, title, lifecycle_state }`.
- Produces: `buildAttackSurfaceModel(input): AttackSurfaceModel` with stable `nodes`, aggregate metrics, and highest-priority asset summary.

- [ ] **Step 1: Write tests for healthy, pending, and risk node classification, severity ordering, deterministic placement, ten-node cap, and empty state.**
- [ ] **Step 2: Run the focused test and confirm it fails because the model does not exist.**
- [ ] **Step 3: Implement the minimal pure model builder and exported types.**
- [ ] **Step 4: Run the model tests and confirm green.**

### Task 3: WebGL attack-surface renderer

**Files:**
- Create: `components/dashboard/WebGLAttackSurface.tsx`
- Test: `tests/components/webgl-attack-surface.test.tsx`

**Interfaces:**
- Consumes: `AttackSurfaceModel` from Task 2.
- Produces: an accessible scene wrapper with an `aria-hidden` canvas, DOM labels, fallback state, and deterministic visual-node mapping.

- [ ] **Step 1: Write structural tests for canvas accessibility, real node labels, empty-state copy, and fallback DOM.**
- [ ] **Step 2: Run focused tests and confirm failure because the component does not exist.**
- [ ] **Step 3: Implement the client component with raw WebGL shader/program setup, radial geometry, state colors, pointer parallax, visibility pause, DPR cap, reduced-motion static frame, and context-failure fallback.**
- [ ] **Step 4: Run component tests and typecheck.**

### Task 4: Immersive authenticated shell variant

**Files:**
- Modify: `components/AppShell.tsx`
- Create: `components/ImmersiveDashboardNav.tsx`
- Test: `tests/components/app-shell.test.tsx`
- Modify: `app/forge-shell.css`

**Interfaces:**
- `AppShell` gains optional `variant?: "default" | "immersive"`.
- `variant="default"` preserves all existing authenticated pages.
- `variant="immersive"` renders a floating top dock and no left sidebar.

- [ ] **Step 1: Add failing tests proving default shell remains unchanged and immersive shell exposes Overview, Assets, Findings, workspace identity, and sign-out.**
- [ ] **Step 2: Run tests and confirm red.**
- [ ] **Step 3: Implement the optional variant and responsive floating navigation.**
- [ ] **Step 4: Run shell tests and existing navigation tests.**

### Task 5: Recompose dashboard home around real data

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `app/forge-dashboard.css`
- Test: `tests/dashboard/dashboard-composition.test.tsx`

**Interfaces:**
- `DashboardPage` queries asset identity fields and bounded active finding data, builds `AttackSurfaceModel`, and passes it to `WebGLAttackSurface`.
- The first viewport uses `AppShell variant="immersive"`.

- [ ] **Step 1: Write source/structure tests for the approved headline, WebGL scene, real-data metric labels, immersive shell variant, and absence of fake `sensors`, `risk paths`, or `exposure score` claims.**
- [ ] **Step 2: Run tests and confirm red against the existing conventional dashboard.**
- [ ] **Step 3: Implement the immersive composition with editorial left column, WebGL figure, four real metrics, highest-priority real asset panel, next action, and scene-status strip.**
- [ ] **Step 4: Add desktop/tablet/mobile CSS matching the approved concept proportions while preserving readable fallbacks.**
- [ ] **Step 5: Run dashboard tests and typecheck.**

### Task 6: Acceptance and merge

**Files:**
- Review all files changed on `feat/living-attack-surface-webgl-v2`.

- [ ] **Step 1: Run focused brand, topology, scene, shell, and dashboard tests.**
- [ ] **Step 2: Run the full Vitest suite.**
- [ ] **Step 3: Run `npm run typecheck`.**
- [ ] **Step 4: Run the production Next.js build with `NODE_ENV=production`.**
- [ ] **Step 5: Run npm audit and existing CLI/scanner benchmark acceptance gates if dependency state changed.**
- [ ] **Step 6: Review Vercel preview on desktop and mobile-sized layouts if preview environment is available.**
- [ ] **Step 7: Review the exact GitHub diff for security-boundary leakage and unintended dependency/schema changes.**
- [ ] **Step 8: Open a PR, review the exact PR head, merge with expected-head protection and `[skip ci]`, verify production, then ancestry-check and remove the merged branch and disposable previews.**
