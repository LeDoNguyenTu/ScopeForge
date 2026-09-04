# ScopeForge Command Center UI v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the ScopeForge public command-center experience with collision-safe responsive layouts, functional navigation, a cold-load boot gate, and a high-fidelity adaptive Three.js attack-surface scene.

**Architecture:** Keep the landing page semantic and server-rendered, then progressively enhance only the visual layer on the client. Use Three.js r149 directly, procedural geometry, adaptive quality tiers, a versioned readiness marker, and a fail-open SVG fallback. Desktop, tablet, and mobile share semantic content but use independent CSS grid-area compositions so no viewport detection or hydration mismatch is required.

**Tech Stack:** Next.js 15.5.24, React 19.1, TypeScript 5.8, Three.js 0.149.0, Vitest 3.2, Testing Library, CSS media queries, browser localStorage and Performance APIs.

**Spec:** `docs/superpowers/specs/2026-08-30-command-center-ui-v4-design.md`

## Global Constraints

- Use Three.js runtime `0.149.0` to stay aligned with the approved ThreeUI r149 technical reference.
- Do not add React Three Fiber or a second rendering framework.
- Do not modify Supabase schema, RLS, authentication authorization, worker contracts, runtime networking, hosted runtime gates, Phase 6D, scanner authority, or Turnstile behavior.
- Do not display fake Cloudflare checks or fake live telemetry.
- Public illustrative metrics must remain explicitly labeled as illustrative.
- Cold-load boot only. Warm repeat visits must not be forced through a decorative loader.
- No GitHub Actions.
- Every commit message must contain `[skip ci]`.
- No horizontal page overflow at supported viewports.
- Reduced motion and WebGL-unavailable paths must remain usable.

---

## File Structure

### New files

- `components/landing/LandingBootGate.tsx` - cold/warm boot decision and release lifecycle.
- `components/landing/ScopeForgeBootScreen.tsx` - truthful scene initialization progress UI.
- `components/landing/attack-surface/constants.ts` - scene version, colors, arm definitions, quality constants.
- `components/landing/attack-surface/quality.ts` - deterministic quality-tier selection.
- `components/landing/attack-surface/progress.ts` - weighted real initialization milestone tracker.
- `components/landing/attack-surface/geometry.ts` - procedural hub, arm, truss, tower, and path geometry builders.
- `components/landing/attack-surface/materials.ts` - PBR, glass, wireframe, and emissive material factory.
- `components/landing/attack-surface/animation.ts` - frame updates, scan pulses, camera parallax, visibility handling.
- `components/landing/attack-surface/createAttackSurfaceScene.ts` - Three.js scene assembly and disposal interface.
- `components/landing/AttackSurfaceScene.tsx` - client renderer host and fallback transition.
- `components/landing/AttackSurfaceFallback.tsx` - accessible DOM/SVG fallback.
- `tests/landing/boot-gate.test.tsx` - cold/warm/reduced-motion loader behavior.
- `tests/landing/attack-surface-quality.test.ts` - quality selection contract.
- `tests/landing/attack-surface-progress.test.ts` - real progress milestone contract.
- `tests/components/AttackSurfaceScene.test.tsx` - renderer host fallback/lifecycle.
- `tests/landing/public-navigation.test.tsx` - real public destination contract.

### Modified files

- `package.json` and lockfile - add `three@0.149.0` only.
- `app/page.tsx` - wrap landing visual enhancement in `LandingBootGate` and preserve below-fold sections.
- `components/landing/PublicNav.tsx` - remove placeholder Pricing/Company/Use Cases controls and expose only real destinations.
- `components/landing/CommandCenterLandingHero.tsx` - convert page-level absolute composition into named layout regions and reusable panel blocks.
- `components/landing/CommandCenterSurface.tsx` - retire raw WebGL implementation after Three.js host is proven; keep compatibility only until migration task is green.
- `app/exact-command-center.css` - replace offset-heavy rules with desktop/tablet/mobile grid-area contracts and larger telemetry hierarchy.
- `app/globals.css` - only if boot overlay/global safe-area primitives cannot remain local.
- existing landing/component tests - update assertions to v4 labels and navigation.

---

### Task 1: Add Three.js r149 and deterministic quality selection

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `components/landing/attack-surface/constants.ts`
- Create: `components/landing/attack-surface/quality.ts`
- Create: `tests/landing/attack-surface-quality.test.ts`

**Interfaces:**
- Produces: `type AttackSurfaceQuality = "high" | "balanced" | "mobile" | "reduced"`
- Produces: `selectAttackSurfaceQuality(input: QualityInput): AttackSurfaceQuality`
- Produces: `QUALITY_PROFILES: Record<AttackSurfaceQuality, QualityProfile>`

- [ ] **Step 1: Write the failing quality-tier test**

```ts
import { describe, expect, it } from "vitest";
import { selectAttackSurfaceQuality } from "@/components/landing/attack-surface/quality";

describe("selectAttackSurfaceQuality", () => {
  it("uses high quality for large capable desktops", () => {
    expect(selectAttackSurfaceQuality({ width: 1536, dpr: 2, reducedMotion: false, deviceMemory: 8 })).toBe("high");
  });

  it("uses mobile quality below 768px", () => {
    expect(selectAttackSurfaceQuality({ width: 430, dpr: 3, reducedMotion: false, deviceMemory: 6 })).toBe("mobile");
  });

  it("always honors reduced motion", () => {
    expect(selectAttackSurfaceQuality({ width: 1536, dpr: 2, reducedMotion: true, deviceMemory: 8 })).toBe("reduced");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/landing/attack-surface-quality.test.ts`

Expected: FAIL because `quality.ts` does not exist.

- [ ] **Step 3: Add Three.js r149 only**

Run: `npm install three@0.149.0 --save-exact`

Verify `package.json` contains exactly:

```json
"three": "0.149.0"
```

Do not add `@react-three/fiber`, `@react-three/drei`, or a post-processing package. Use Three.js `examples/jsm` modules when needed.

- [ ] **Step 4: Implement quality constants and selector**

```ts
export type AttackSurfaceQuality = "high" | "balanced" | "mobile" | "reduced";

export type QualityInput = {
  width: number;
  dpr: number;
  reducedMotion: boolean;
  deviceMemory?: number;
};

export type QualityProfile = {
  dprCap: number;
  armSegments: number;
  particles: number;
  activePulses: number;
  bloom: boolean;
  transparentPanels: boolean;
};

export const QUALITY_PROFILES: Record<AttackSurfaceQuality, QualityProfile> = {
  high: { dprCap: 2, armSegments: 12, particles: 180, activePulses: 6, bloom: true, transparentPanels: true },
  balanced: { dprCap: 1.6, armSegments: 9, particles: 110, activePulses: 4, bloom: true, transparentPanels: true },
  mobile: { dprCap: 1.35, armSegments: 6, particles: 56, activePulses: 2, bloom: false, transparentPanels: false },
  reduced: { dprCap: 1.25, armSegments: 6, particles: 24, activePulses: 0, bloom: false, transparentPanels: false },
};

export function selectAttackSurfaceQuality(input: QualityInput): AttackSurfaceQuality {
  if (input.reducedMotion) return "reduced";
  if (input.width < 768) return "mobile";
  if (input.width < 1280 || (input.deviceMemory !== undefined && input.deviceMemory < 6)) return "balanced";
  return "high";
}
```

- [ ] **Step 5: Run test and typecheck**

Run:

```bash
npx vitest run tests/landing/attack-surface-quality.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/landing/attack-surface tests/landing/attack-surface-quality.test.ts
git commit -m "Add adaptive Three.js scene quality [skip ci]"
```

---

### Task 2: Replace placeholder public navigation with real destinations

**Files:**
- Modify: `components/landing/PublicNav.tsx`
- Create: `tests/landing/public-navigation.test.tsx`

**Interfaces:**
- Produces only these signed-out destinations: `/`, `#platform`, `#security-model`, GitHub repository, `/auth/sign-in`, `/auth/sign-up`.

- [ ] **Step 1: Write the navigation contract test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicNav from "@/components/landing/PublicNav";

describe("PublicNav", () => {
  it("shows only destinations that exist", () => {
    render(<PublicNav />);
    expect(screen.getByRole("link", { name: /product/i })).toHaveAttribute("href", "#platform");
    expect(screen.getByRole("link", { name: /security model/i })).toHaveAttribute("href", "#security-model");
    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute("href", "https://github.com/LeDoNguyenTu/ScopeForge");
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/auth/sign-in");
    expect(screen.getByRole("link", { name: /create workspace/i })).toHaveAttribute("href", "/auth/sign-up");
    expect(screen.queryByText("Pricing")).not.toBeInTheDocument();
    expect(screen.queryByText("Company")).not.toBeInTheDocument();
    expect(screen.queryByText("Use Cases")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and confirm RED against v3 nav**

Run: `npx vitest run tests/landing/public-navigation.test.tsx`

Expected: FAIL because v3 still exposes placeholder links.

- [ ] **Step 3: Implement functional desktop/mobile nav**

Use the existing ScopeForge wordmark. Desktop links:

```tsx
<a href="#platform">Product</a>
<a href="#security-model">Security model</a>
<a href="https://github.com/LeDoNguyenTu/ScopeForge" target="_blank" rel="noreferrer">GitHub</a>
<Link href="/auth/sign-in">Sign in</Link>
<Link className="commandRequestAccess" href="/auth/sign-up">Create workspace <ArrowRight size={14} /></Link>
```

Mirror the same destinations in the mobile disclosure menu.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx vitest run tests/landing/public-navigation.test.tsx tests/landing/living-attack-surface.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/landing/PublicNav.tsx tests/landing/public-navigation.test.tsx
git commit -m "Make public command navigation functional [skip ci]"
```

---

### Task 3: Rebuild the composition around bounded layout regions

**Files:**
- Modify: `components/landing/CommandCenterLandingHero.tsx`
- Modify: `app/exact-command-center.css`
- Modify: `tests/components/CommandCenterLandingHero.test.tsx`

**Interfaces:**
- Produces CSS layout regions: `hero-copy`, `scene`, `metrics`, `overview`, `runtime`.
- Public metrics remain illustrative and visibly labeled.

- [ ] **Step 1: Extend the hero regression test**

Add assertions that the hero exposes one semantic region for each layout block and that the illustrative label remains present:

```tsx
expect(screen.getByTestId("command-copy")).toBeInTheDocument();
expect(screen.getByTestId("command-scene")).toBeInTheDocument();
expect(screen.getByTestId("command-metrics")).toBeInTheDocument();
expect(screen.getByTestId("command-overview")).toBeInTheDocument();
expect(screen.getByTestId("command-runtime")).toBeInTheDocument();
expect(screen.getByText(/illustrative platform telemetry/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run and confirm RED**

Run: `npx vitest run tests/components/CommandCenterLandingHero.test.tsx`

Expected: FAIL because the region test IDs do not exist.

- [ ] **Step 3: Refactor hero markup into region wrappers**

The top-level hero must contain normal-flow region elements rather than page-level absolute placement:

```tsx
<section className="commandHeroV4" aria-labelledby="command-hero-title">
  <div className="commandHeroCopyV4" data-testid="command-copy">...</div>
  <div className="commandHeroSceneV4" data-testid="command-scene"><AttackSurfaceScene /></div>
  <div className="commandMetricAreaV4" data-testid="command-metrics">...</div>
  <article className="commandOverviewPanelV4" data-testid="command-overview">...</article>
  <div className="commandRuntimeBarV4" data-testid="command-runtime">...</div>
</section>
```

Do not use negative page offsets to make regions overlap.

- [ ] **Step 4: Replace layout CSS with explicit grid areas**

Desktop master:

```css
.commandHeroV4 {
  display: grid;
  grid-template-columns: minmax(420px, 0.86fr) minmax(560px, 1.14fr);
  grid-template-rows: auto auto minmax(176px, auto) 64px;
  grid-template-areas:
    "copy scene"
    "metrics scene"
    "overview scene"
    "overview runtime";
  column-gap: clamp(28px, 3vw, 56px);
  row-gap: 14px;
  width: min(1440px, calc(100vw - 64px));
  margin: 0 auto;
  min-height: calc(100svh - 108px);
  overflow: clip;
}
```

Tablet uses a 2-column layout with scene spanning both columns where required.

Mobile must use:

```css
@media (max-width: 767px) {
  .commandHeroV4 {
    width: min(100% - 32px, 680px);
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    grid-template-areas:
      "copy"
      "metrics"
      "scene"
      "runtime"
      "overview";
    row-gap: 18px;
    overflow: visible;
  }
}
```

- [ ] **Step 5: Increase telemetry hierarchy**

Desktop primary metric values: `clamp(1.4rem, 1.7vw, 1.75rem)`.
Mobile primary metric values: `clamp(1.45rem, 6vw, 1.85rem)`.
Do not reduce labels below `0.72rem` on mobile.

- [ ] **Step 6: Add alignment invariants to CSS**

```css
.commandHeroV4,
.commandHeroV4 * { box-sizing: border-box; }
.commandHeroV4 > * { min-width: 0; }
.commandMetricGridV4 { align-items: stretch; }
.commandMetricCardV4 { overflow: hidden; }
.commandHeroSceneV4 { position: relative; min-width: 0; overflow: hidden; }
.commandRuntimeBarV4 { min-width: 0; overflow: hidden; }
```

Respect `env(safe-area-inset-left)` and `env(safe-area-inset-right)` on mobile header/page padding.

- [ ] **Step 7: Run focused suite and typecheck**

```bash
npx vitest run tests/components/CommandCenterLandingHero.test.tsx tests/landing/living-attack-surface.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/landing/CommandCenterLandingHero.tsx app/exact-command-center.css tests/components/CommandCenterLandingHero.test.tsx
git commit -m "Rebuild command center responsive layout [skip ci]"
```

---

### Task 4: Implement truthful cold-load boot progress

**Files:**
- Create: `components/landing/attack-surface/progress.ts`
- Create: `components/landing/LandingBootGate.tsx`
- Create: `components/landing/ScopeForgeBootScreen.tsx`
- Create: `tests/landing/attack-surface-progress.test.ts`
- Create: `tests/landing/boot-gate.test.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- `SCENE_VERSION = "scopeforge-command-center-v4"`
- `READY_STORAGE_KEY = "scopeforge:attack-surface-ready"`
- `BootMilestone = "module" | "capability" | "geometry" | "materials" | "first-frame"`
- `createSceneProgress(): { mark(milestone): number; value(): number }`
- `LandingBootGate` consumes a scene-ready event and writes the version marker only after first stable frame.

- [ ] **Step 1: Write milestone progress tests**

```ts
import { expect, it } from "vitest";
import { createSceneProgress } from "@/components/landing/attack-surface/progress";

it("reports monotonic progress from real initialization milestones", () => {
  const progress = createSceneProgress();
  expect(progress.value()).toBe(0);
  expect(progress.mark("module")).toBe(20);
  expect(progress.mark("capability")).toBe(32);
  expect(progress.mark("geometry")).toBe(62);
  expect(progress.mark("materials")).toBe(82);
  expect(progress.mark("first-frame")).toBe(100);
});
```

- [ ] **Step 2: Write cold/warm boot gate tests**

Mock localStorage and assert:

```tsx
it("shows boot UI when the scene version is not warm", () => {
  localStorage.removeItem("scopeforge:attack-surface-ready");
  render(<LandingBootGate><div>Landing</div></LandingBootGate>);
  expect(screen.getByText(/preparing living attack surface/i)).toBeInTheDocument();
});

it("does not block a warm repeat visit", () => {
  localStorage.setItem("scopeforge:attack-surface-ready", "scopeforge-command-center-v4");
  render(<LandingBootGate><div>Landing</div></LandingBootGate>);
  expect(screen.getByText("Landing")).toBeVisible();
});
```

- [ ] **Step 3: Run and confirm RED**

```bash
npx vitest run tests/landing/attack-surface-progress.test.ts tests/landing/boot-gate.test.tsx
```

- [ ] **Step 4: Implement milestone tracker**

Use fixed weights only for completed real tasks. Never advance progress on a timer.

```ts
const milestoneProgress: Record<BootMilestone, number> = {
  module: 20,
  capability: 32,
  geometry: 62,
  materials: 82,
  "first-frame": 100,
};
```

- [ ] **Step 5: Implement boot decision**

On mount:

1. read the versioned readiness marker
2. if marker matches, reveal content immediately
3. if reduced motion or WebGL is unavailable, reveal content immediately and use fallback/reduced scene
4. otherwise show boot overlay until first-frame event
5. impose an 8-second maximum wait, then reveal content in fallback/low-quality mode
6. write the readiness marker only after successful first frame

Do not label any stage `Cloudflare`.

- [ ] **Step 6: Implement boot UI**

The boot screen must contain:

```tsx
<p>Welcome to ScopeForge</p>
<h1>Preparing living attack surface</h1>
<output aria-live="polite">{progress}%</output>
<div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} />
<p>{stageLabel}</p>
```

Allowed stage labels:

- Checking browser capabilities
- Initializing renderer
- Building attack surface
- Preparing materials
- Rendering first frame

- [ ] **Step 7: Integrate with `app/page.tsx`**

Wrap only the landing visual experience. Do not put authenticated application routes behind this boot gate.

- [ ] **Step 8: Run tests and typecheck**

```bash
npx vitest run tests/landing/attack-surface-progress.test.ts tests/landing/boot-gate.test.tsx
npm run typecheck
```

- [ ] **Step 9: Commit**

```bash
git add app/page.tsx components/landing/LandingBootGate.tsx components/landing/ScopeForgeBootScreen.tsx components/landing/attack-surface/progress.ts tests/landing
git commit -m "Add cold-load attack surface boot gate [skip ci]"
```

---

### Task 5: Build procedural Three.js geometry and materials

**Files:**
- Create: `components/landing/attack-surface/geometry.ts`
- Create: `components/landing/attack-surface/materials.ts`
- Create: `components/landing/attack-surface/createAttackSurfaceScene.ts`
- Create: `tests/landing/attack-surface-scene-contract.test.ts`

**Interfaces:**
- `createAttackSurfaceGeometry(profile: QualityProfile): THREE.Group`
- `createAttackSurfaceMaterials(): AttackSurfaceMaterials`
- `createAttackSurfaceScene(options): AttackSurfaceController`
- `AttackSurfaceController` exposes `render(time)`, `resize(width,height,dpr)`, `setPointer(x,y)`, `setVisible(value)`, `dispose()` and `firstFrame: Promise<void>`.

- [ ] **Step 1: Write scene contract tests**

Use structural tests for deterministic constants rather than trying to render WebGL in JSDOM:

```ts
expect(ATTACK_SURFACE_ARMS).toHaveLength(6);
expect(SCENE_VERSION).toBe("scopeforge-command-center-v4");
expect(QUALITY_PROFILES.mobile.particles).toBeLessThan(QUALITY_PROFILES.high.particles);
expect(QUALITY_PROFILES.mobile.transparentPanels).toBe(false);
```

- [ ] **Step 2: Run and confirm RED**

Run: `npx vitest run tests/landing/attack-surface-scene-contract.test.ts`

- [ ] **Step 3: Build central hub geometry**

Use `THREE.Group`, `CylinderGeometry`, `TorusGeometry`, `RingGeometry`, and `BoxGeometry`.

Hub requirements:

- three concentric metallic rings
- two wireframe rings
- central raised Forge Aperture mount
- subtle orange emissive center element

Do not use a loaded external 3D model for the core.

- [ ] **Step 4: Build six truss arms procedurally**

Each arm must contain:

- two dark metallic longitudinal rails
- two upper wire rails
- cross-bracing generated from `profile.armSegments`
- a translucent or wireframe surface plate when `transparentPanels` is true
- one endpoint platform
- 1-3 stacked tower blocks depending on arm definition

Reuse geometries/material instances across arms where practical.

- [ ] **Step 5: Build risk and healthy paths**

Use `THREE.CatmullRomCurve3` plus `TubeGeometry` or narrow line geometry for selected routes.

Healthy routes use teal/cyan emissive material.
Risk routes use orange/red emissive material.

- [ ] **Step 6: Create material factory**

Use:

```ts
new THREE.MeshStandardMaterial({
  color: 0x0a1418,
  metalness: 0.78,
  roughness: 0.34,
});
```

Glass only on profiles that allow it:

```ts
new THREE.MeshPhysicalMaterial({
  color: 0x16343a,
  transparent: true,
  opacity: 0.22,
  metalness: 0.15,
  roughness: 0.18,
  transmission: 0.25,
  depthWrite: false,
});
```

Use restrained emissive intensity. Do not make the whole object neon.

- [ ] **Step 7: Assemble scene and lights**

Use:

- `PerspectiveCamera`
- dim ambient/hemisphere light
- cool key light from upper right
- soft teal point light near hub
- small warm point light near the risk path
- exponential fog or `FogExp2` with a low density

- [ ] **Step 8: Add optional bloom using Three.js examples**

Import dynamically from:

```ts
three/examples/jsm/postprocessing/EffectComposer.js
three/examples/jsm/postprocessing/RenderPass.js
three/examples/jsm/postprocessing/UnrealBloomPass.js
```

Enable only when `profile.bloom === true`.

- [ ] **Step 9: Run structural tests and typecheck**

```bash
npx vitest run tests/landing/attack-surface-scene-contract.test.ts
npm run typecheck
```

- [ ] **Step 10: Commit**

```bash
git add components/landing/attack-surface tests/landing/attack-surface-scene-contract.test.ts
git commit -m "Build dimensional Three.js attack surface [skip ci]"
```

---

### Task 6: Implement advanced motion without frame-budget waste

**Files:**
- Create: `components/landing/attack-surface/animation.ts`
- Modify: `components/landing/attack-surface/createAttackSurfaceScene.ts`
- Create: `tests/landing/attack-surface-animation.test.ts`

**Interfaces:**
- `createAttackSurfaceAnimator(sceneRefs, profile): AttackSurfaceAnimator`
- `AttackSurfaceAnimator.update(timeMs, pointer): void`
- `AttackSurfaceAnimator.setVisible(boolean): void`
- `AttackSurfaceAnimator.dispose(): void`

- [ ] **Step 1: Write animation policy tests**

Test pure helpers:

```ts
expect(getPulseCount("high")).toBe(6);
expect(getPulseCount("mobile")).toBe(2);
expect(getPulseCount("reduced")).toBe(0);
expect(getParallaxStrength("mobile")).toBeLessThan(getParallaxStrength("high"));
```

- [ ] **Step 2: Run and confirm RED**

Run: `npx vitest run tests/landing/attack-surface-animation.test.ts`

- [ ] **Step 3: Implement low-amplitude scene motion**

Per frame:

- hub rotation under `0.08 rad/s`
- ring layers rotate at different slow rates
- camera target shifts gently using pointer interpolation
- endpoint towers pulse emissive intensity slowly
- particles drift with bounded wraparound

Do not allocate new vectors/materials inside the frame loop. Reuse scratch vectors.

- [ ] **Step 4: Implement moving path pulses**

Create a small pool of pulse meshes and move them along cached curve samples. Do not instantiate/destroy pulse meshes per frame.

- [ ] **Step 5: Pause work when hidden**

Use `document.visibilitychange` in the React host and `IntersectionObserver` for the scene container. The animation loop must stop or skip rendering when the page/scene is not visible.

- [ ] **Step 6: Respect reduced motion**

For `reduced` profile:

- no travelling pulses
- no continuous ring rotation
- static camera
- retain visual color/status state

- [ ] **Step 7: Run tests and typecheck**

```bash
npx vitest run tests/landing/attack-surface-animation.test.ts
npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
git add components/landing/attack-surface tests/landing/attack-surface-animation.test.ts
git commit -m "Add adaptive attack surface motion [skip ci]"
```

---

### Task 7: Replace the raw WebGL host with the Three.js renderer and fail-open fallback

**Files:**
- Create: `components/landing/AttackSurfaceFallback.tsx`
- Create: `components/landing/AttackSurfaceScene.tsx`
- Modify: `components/landing/CommandCenterLandingHero.tsx`
- Modify: `tests/components/CommandCenterSurface.test.tsx`
- Create: `tests/components/AttackSurfaceScene.test.tsx`
- Delete after green migration: `components/landing/CommandCenterSurface.tsx`

**Interfaces:**
- `AttackSurfaceScene({ onProgress?, onReady? })`
- `onProgress(value: number, label: string): void`
- `onReady(): void`

- [ ] **Step 1: Write renderer-host fallback tests**

Mock dynamic scene creation and assert:

```tsx
it("keeps the fallback visible until the first stable frame", async () => {
  render(<AttackSurfaceScene />);
  expect(screen.getByTestId("attack-surface-fallback")).toBeInTheDocument();
});

it("does not remove page content when WebGL initialization rejects", async () => {
  // mock createAttackSurfaceScene to reject
  render(<AttackSurfaceScene />);
  expect(await screen.findByTestId("attack-surface-fallback")).toBeVisible();
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `npx vitest run tests/components/AttackSurfaceScene.test.tsx`

- [ ] **Step 3: Implement dynamic Three.js import**

Keep the scene out of SSR execution:

```ts
const module = await import("@/components/landing/attack-surface/createAttackSurfaceScene");
```

Mark real progress milestones as the module, capability, geometry/materials and first frame complete.

- [ ] **Step 4: Add resize and DPR handling**

Use `ResizeObserver` on the scene container. Re-select profile only when crossing relevant width/reduced-motion capability boundaries. Avoid calling `getBoundingClientRect()` every frame.

- [ ] **Step 5: Add pointer handling**

Use pointer coordinates normalized within the scene container. Ignore pointer parallax on touch-first mobile profiles.

- [ ] **Step 6: Add complete disposal**

On unmount:

- cancel RAF
- disconnect observers
- remove listeners
- dispose renderer/composer
- dispose geometries/materials/textures
- remove canvas references

- [ ] **Step 7: Switch hero to `AttackSurfaceScene` and remove old raw renderer**

After focused tests pass, delete `components/landing/CommandCenterSurface.tsx` and update imports/tests.

- [ ] **Step 8: Run focused tests and typecheck**

```bash
npx vitest run tests/components/AttackSurfaceScene.test.tsx tests/components/CommandCenterSurface.test.tsx tests/components/CommandCenterLandingHero.test.tsx
npm run typecheck
```

If the old test becomes obsolete, rename its contract to `AttackSurfaceScene.test.tsx` rather than retaining duplicate coverage.

- [ ] **Step 9: Commit**

```bash
git add components/landing tests/components
git commit -m "Replace landing renderer with Three.js scene [skip ci]"
```

---

### Task 8: Finish desktop, tablet, mobile visual parity and safe-area behavior

**Files:**
- Modify: `app/exact-command-center.css`
- Modify: `components/landing/CommandCenterLandingHero.tsx`
- Modify: `tests/components/CommandCenterLandingHero.test.tsx`

**Interfaces:**
- Desktop reference viewport: 1536 x 864.
- Mobile reference viewports: 430 x 932, 390 x 844, 360 x 800.

- [ ] **Step 1: Tune desktop master geometry**

Use the approved render as the visual reference for:

- top capsule width and vertical position
- headline line breaks and max width
- 3D scene footprint
- metric band height
- overview panel height
- runtime rail width and alignment
- teal/cyan/orange color balance

Do not change the functional navigation destinations from Task 2.

- [ ] **Step 2: Add explicit tablet CSS**

At `768px-1023px`, avoid desktop overlay assumptions. Scene should receive its own bounded row and never cover copy/cards.

- [ ] **Step 3: Tune mobile composition**

Mobile requirements:

- safe-area-aware horizontal padding
- one readable hero line measure
- actions never wider than viewport
- two-column metrics at most
- dedicated scene aspect ratio around `1 / 0.86` to `1 / 0.95` depending on width
- runtime bar becomes three compact cells
- overview card below scene
- no horizontal overflow

- [ ] **Step 4: Clamp floating scene labels**

All DOM labels around the scene must use percentages within the scene container and CSS clamping:

```css
.attackSurfaceLabel {
  max-width: min(150px, 28%);
  overflow-wrap: anywhere;
}
```

Hide nonessential labels on narrow mobile rather than letting them collide.

- [ ] **Step 5: Add readable metric minimums**

Ensure mobile primary values remain at least `1.45rem`, labels `0.72rem`, and action text `0.9rem`.

- [ ] **Step 6: Run component and landing tests**

```bash
npx vitest run tests/components/CommandCenterLandingHero.test.tsx tests/landing/living-attack-surface.test.tsx tests/landing/public-navigation.test.tsx
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add app/exact-command-center.css components/landing/CommandCenterLandingHero.tsx tests
git commit -m "Polish responsive command center composition [skip ci]"
```

---

### Task 9: Add warm-cache hints and startup performance safeguards

**Files:**
- Modify: `components/landing/LandingBootGate.tsx`
- Modify: `components/landing/AttackSurfaceScene.tsx`
- Modify: `app/layout.tsx` only if a safe preload hint is beneficial
- Modify: `tests/landing/boot-gate.test.tsx`

**Interfaces:**
- Warm marker is versioned and invalidates automatically when `SCENE_VERSION` changes.
- No service worker and no whole-site cache.

- [ ] **Step 1: Test scene-version invalidation**

```tsx
localStorage.setItem("scopeforge:attack-surface-ready", "old-version");
render(<LandingBootGate><div>Landing</div></LandingBootGate>);
expect(screen.getByText(/preparing living attack surface/i)).toBeInTheDocument();
```

- [ ] **Step 2: Implement version marker behavior**

Only write the current version after first frame. An older version must be treated as cold.

- [ ] **Step 3: Add module prefetch after semantic HTML becomes interactive**

Use a client-side idle opportunity:

```ts
const schedule = window.requestIdleCallback ?? ((cb: IdleRequestCallback) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 1));
schedule(() => void import("@/components/landing/attack-surface/createAttackSurfaceScene"));
```

Do not preload authenticated application chunks or all routes.

- [ ] **Step 4: Keep first paint independent of Three.js**

Semantic hero text, navigation, fallback artwork, and primary CTA must be present in initial server HTML.

- [ ] **Step 5: Run boot/scene tests**

```bash
npx vitest run tests/landing/boot-gate.test.tsx tests/components/AttackSurfaceScene.test.tsx
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add components/landing app/layout.tsx tests/landing/boot-gate.test.tsx
git commit -m "Optimize command center cold and warm startup [skip ci]"
```

---

### Task 10: Full acceptance, exact diff review, PR, production verification

**Files:**
- Modify only if acceptance reveals a defect.
- Update: `docs/development/CURRENT_STATE.md` only after the application release is verified and only with stable facts.

**Interfaces:**
- No unreviewed temporary build command may enter the PR.
- Merge only the exact head that passed acceptance or a head whose only subsequent change is independently verified documentation/build-script restoration.

- [ ] **Step 1: Run focused visual-system suite**

```bash
npx vitest run \
  tests/landing/attack-surface-quality.test.ts \
  tests/landing/attack-surface-progress.test.ts \
  tests/landing/attack-surface-animation.test.ts \
  tests/landing/attack-surface-scene-contract.test.ts \
  tests/landing/boot-gate.test.tsx \
  tests/landing/public-navigation.test.tsx \
  tests/components/AttackSurfaceScene.test.tsx \
  tests/components/CommandCenterLandingHero.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full repository acceptance**

```bash
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js --version
npm run benchmark:scanner
npm audit --audit-level=info
NODE_ENV=production npm run build
```

Expected:

- all tests PASS
- TypeScript PASS
- CLI prints `ScopeForge 0.1.0`
- scanner benchmark stays under its existing budget with 0 errors
- audit reports 0 known vulnerabilities
- Next.js production build PASS

- [ ] **Step 3: Review dependency delta**

Confirm the only new runtime dependency is:

```json
"three": "0.149.0"
```

- [ ] **Step 4: Review security boundary diff**

Confirm there are no changes under:

- Supabase migrations/policies
- runtime-network
- workers
- repository acquisition authority
- hosted runtime gates
- Phase 6D implementation

- [ ] **Step 5: Verify visual invariants at target sizes**

At minimum inspect:

- 1536 x 864
- 1440 x 900
- 1280 x 800
- 1024 x 768
- 430 x 932
- 390 x 844
- 360 x 800

Check:

- no horizontal overflow
- no copy/scene/card overlap
- all controls inside their borders
- scene labels inside scene region
- readable metrics
- loader only on cold version
- warm reload enters immediately
- reduced-motion path does not animate continuously

- [ ] **Step 6: Open PR and review exact GitHub diff**

PR body must state:

- responsive v4 layout
- real navigation destinations
- Three.js r149 addition
- cold-load boot behavior
- adaptive quality/fallback
- exact acceptance evidence
- explicit security boundary

- [ ] **Step 7: Merge only if exact head is safe**

Merge message must contain `[skip ci]`.

- [ ] **Step 8: Verify production Vercel artifact**

Confirm:

- deployment is READY
- commit SHA equals merged release SHA
- `scopeforge.dev` alias attached with no alias error
- `/` returns 200 and contains v4 command-center structure
- `/auth/sign-in` returns 200
- `/auth/sign-up` returns 200
- unauthenticated `/dashboard` resolves into the sign-in experience
- favicon/manifest remain correct
- no Vercel runtime errors in post-release window
- Supabase security advisor returns no security lints

- [ ] **Step 9: Reconcile documentation and cleanup**

If `CURRENT_STATE.md` needs a stable visual-release note, commit docs-only with `[skip ci]` and do not embed self-invalidating Vercel deployment IDs.

Delete merged branches/previews only when safe delete operations are available and ancestry is proven. Do not bypass unavailable connector operations.
