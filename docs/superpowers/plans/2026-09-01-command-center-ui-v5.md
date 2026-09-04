# Command Center UI V5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visually rejected Command Center UI V4 with a high-fidelity Three.js V5 experience that is materially closer to the approved ScopeForge reference on desktop and mobile.

**Architecture:** Keep the public landing page presentation-only, but replace the sparse raw-WebGL renderer with a small Three.js scene package split by model, geometry, materials, lighting/effects, quality, animation, and lifecycle. Desktop and mobile use distinct composition components over shared content/data primitives, with a poster-first boot path and adaptive rendering quality rather than a blanket low-quality mobile mode.

**Tech Stack:** Next.js 15.5.24, React 19.1, TypeScript 5.8, Three.js, Vitest/Testing Library, Vercel Preview, CSS media/container queries.

**Spec:** `docs/superpowers/specs/2026-09-01-command-center-ui-v5-design.md`

## Global Constraints

- PR #49 remains draft until V5 visual acceptance passes.
- Three.js is the only newly approved runtime dependency for this redesign.
- Public telemetry remains explicitly illustrative; it must not be presented as authoritative workspace telemetry.
- No Supabase schema/RLS/auth changes.
- No worker, scanner, runtime-network, Phase 6D, hosted-runtime-gate, or security-authority changes.
- Desktop and mobile are separately art-directed compositions, not one layout reordered by media queries.
- Modern mobile devices must not be forced into low-DPR/no-antialias rendering solely because they are mobile.
- A polished static poster/fallback must be visible before the live 3D scene reaches a stable frame.
- Renderer modules must not import backend authority, Supabase clients, secrets, scanner authority, runtime-worker authority, or canonical evidence.
- Every implementation/documentation commit includes `[skip ci]`.
- Visual acceptance requires deliberate desktop and mobile review against the approved reference, not only DOM/unit-test success.

---

### Task 1: Add Three.js and lock V5 renderer boundaries

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `components/landing/attack-surface-v5/model.ts`
- Create: `tests/components/attack-surface-v5-model.test.ts`

**Interfaces:**
- Produces: `AttackSurfaceV5Entity`, `AttackSurfaceV5Model`, and `createIllustrativeAttackSurfaceV5Model()`.
- Consumes: no backend/runtime modules.

- [ ] **Step 1: Write the failing model-boundary test**

```ts
import { describe, expect, it } from "vitest";
import { createIllustrativeAttackSurfaceV5Model } from "@/components/landing/attack-surface-v5/model";

describe("attack surface V5 visual model", () => {
  it("produces a frozen presentation-only scene model with stable entity identities", () => {
    const model = createIllustrativeAttackSurfaceV5Model();
    expect(Object.isFrozen(model)).toBe(true);
    expect(model.entities.length).toBeGreaterThanOrEqual(6);
    expect(new Set(model.entities.map((entity) => entity.id)).size).toBe(model.entities.length);
    expect(model.entities.some((entity) => entity.state === "risk")).toBe(true);
    expect(model.entities.some((entity) => entity.state === "healthy")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test -- tests/components/attack-surface-v5-model.test.ts`

Expected: FAIL because `attack-surface-v5/model` does not exist.

- [ ] **Step 3: Add Three.js and the minimal frozen model**

Add runtime dependency:

```json
"three": "^0.180.0"
```

Implement:

```ts
export type AttackSurfaceV5State = "healthy" | "risk" | "pending";

export type AttackSurfaceV5Entity = Readonly<{
  id: string;
  label: string;
  detail: string;
  state: AttackSurfaceV5State;
  armIndex: number;
}>;

export type AttackSurfaceV5Model = Readonly<{
  entities: readonly AttackSurfaceV5Entity[];
}>;

export function createIllustrativeAttackSurfaceV5Model(): AttackSurfaceV5Model {
  const entities = [
    { id: "web-app", label: "WEB APPLICATION", detail: "2 Findings", state: "risk", armIndex: 0 },
    { id: "sandbox", label: "SANDBOX", detail: "Isolated", state: "healthy", armIndex: 1 },
    { id: "third-party", label: "THIRD PARTY", detail: "Monitored", state: "healthy", armIndex: 2 },
    { id: "data-store", label: "DATA STORE", detail: "At Risk", state: "risk", armIndex: 3 },
    { id: "identity", label: "IDENTITY", detail: "Healthy", state: "healthy", armIndex: 4 },
    { id: "cloud", label: "CLOUD", detail: "Verified", state: "healthy", armIndex: 5 },
  ].map(Object.freeze);
  return Object.freeze({ entities: Object.freeze(entities) });
}
```

Generate the lockfile with the repository package manager so the Three.js version is pinned by `package-lock.json`.

- [ ] **Step 4: Run focused test and dependency audit**

Run: `npm test -- tests/components/attack-surface-v5-model.test.ts`

Expected: PASS.

Run: `npm audit --audit-level=info`

Expected: no newly introduced vulnerability requiring remediation.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components/landing/attack-surface-v5/model.ts tests/components/attack-surface-v5-model.test.ts
git commit -m "feat: establish command center v5 scene model [skip ci]"
```

---

### Task 2: Build adaptive V5 quality selection without mobile quality punishment

**Files:**
- Create: `components/landing/attack-surface-v5/quality.ts`
- Create: `tests/components/attack-surface-v5-quality.test.ts`

**Interfaces:**
- Produces: `AttackSurfaceV5Quality = "cinematic" | "balanced" | "constrained" | "reduced"` and `selectAttackSurfaceV5Quality(input)`.
- Consumes: viewport width, DPR, reduced-motion preference, device memory, and optional measured frame time.

- [ ] **Step 1: Write failing quality tests**

```ts
import { describe, expect, it } from "vitest";
import { selectAttackSurfaceV5Quality } from "@/components/landing/attack-surface-v5/quality";

describe("V5 adaptive quality", () => {
  it("allows a modern high-DPR phone to use balanced quality", () => {
    expect(selectAttackSurfaceV5Quality({ width: 430, dpr: 3, reducedMotion: false, deviceMemory: 8 })).toBe("balanced");
  });

  it("uses cinematic quality on capable desktop hardware", () => {
    expect(selectAttackSurfaceV5Quality({ width: 1440, dpr: 2, reducedMotion: false, deviceMemory: 8 })).toBe("cinematic");
  });

  it("respects reduced motion regardless of device power", () => {
    expect(selectAttackSurfaceV5Quality({ width: 1440, dpr: 2, reducedMotion: true, deviceMemory: 8 })).toBe("reduced");
  });
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- tests/components/attack-surface-v5-quality.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement explicit capability-based tiers**

Use width only as one signal. Do not use `width < 768 => low quality`. Cap render DPR by tier at approximately 2.0/1.75/1.35/1.25, keep antialiasing enabled for cinematic and balanced, and let constrained/reduced tiers drop expensive effects.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/components/attack-surface-v5-quality.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/landing/attack-surface-v5/quality.ts tests/components/attack-surface-v5-quality.test.ts
git commit -m "feat: add adaptive v5 render quality [skip ci]"
```

---

### Task 3: Build the volumetric Three.js scene primitives

**Files:**
- Create: `components/landing/attack-surface-v5/materials.ts`
- Create: `components/landing/attack-surface-v5/geometry.ts`
- Create: `components/landing/attack-surface-v5/lighting.ts`
- Create: `components/landing/attack-surface-v5/animation.ts`
- Create: `tests/components/attack-surface-v5-geometry.test.ts`

**Interfaces:**
- Produces: `createAttackSurfaceV5Group(model, quality)`, `createV5Materials()`, `createV5Lighting(scene)`, and `updateAttackSurfaceV5Animation(group, elapsed, pointer)`.
- Consumes: Task 1 model and Task 2 quality tier.

- [ ] **Step 1: Write a failing geometry contract test**

```ts
import { describe, expect, it } from "vitest";
import { createIllustrativeAttackSurfaceV5Model } from "@/components/landing/attack-surface-v5/model";
import { describeAttackSurfaceV5Geometry } from "@/components/landing/attack-surface-v5/geometry";

describe("V5 geometry composition", () => {
  it("contains a layered core and at least six structural arms", () => {
    const description = describeAttackSurfaceV5Geometry(createIllustrativeAttackSurfaceV5Model());
    expect(description.coreRingCount).toBeGreaterThanOrEqual(3);
    expect(description.armCount).toBeGreaterThanOrEqual(6);
    expect(description.towerCount).toBeGreaterThanOrEqual(6);
    expect(description.riskPathCount).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- tests/components/attack-surface-v5-geometry.test.ts`

Expected: FAIL because the geometry module does not exist.

- [ ] **Step 3: Implement deterministic geometry description and actual Three.js group**

The central group must include a solid dark platform, three or more counter-rotating rings, emissive center, radial rails, translucent panel layers, and six arm groups. Each arm must include a path, a platform/tower mass, and endpoint node. Risk arms use warm emissive accents; healthy arms use teal/cyan.

Use real Three.js meshes/lines (`Mesh`, `BoxGeometry`, `CylinderGeometry`, `RingGeometry`, `TubeGeometry` or equivalent), not a return to canvas line-only rendering.

- [ ] **Step 4: Run the geometry test and TypeScript check**

Run: `npm test -- tests/components/attack-surface-v5-geometry.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/landing/attack-surface-v5 tests/components/attack-surface-v5-geometry.test.ts
git commit -m "feat: build volumetric command center geometry [skip ci]"
```

---

### Task 4: Add renderer lifecycle, bloom, and stable-frame handoff

**Files:**
- Create: `components/landing/attack-surface-v5/controller.ts`
- Create: `components/landing/attack-surface-v5/effects.ts`
- Create: `components/landing/AttackSurfaceSceneV5.tsx`
- Create: `tests/components/AttackSurfaceSceneV5.test.tsx`

**Interfaces:**
- Produces: `AttackSurfaceSceneV5` React component and `createAttackSurfaceV5Controller(options)` lifecycle controller.
- Consumes: model, quality, geometry, materials, lighting, effects, animation.

- [ ] **Step 1: Write failing structural/fallback tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AttackSurfaceSceneV5 from "@/components/landing/AttackSurfaceSceneV5";

describe("AttackSurfaceSceneV5", () => {
  it("renders a poster before the live canvas is ready", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<AttackSurfaceSceneV5 />);
    expect(screen.getByTestId("attack-surface-v5-poster")).toBeInTheDocument();
  });

  it("keeps semantic labels outside the decorative canvas", () => {
    render(<AttackSurfaceSceneV5 />);
    expect(screen.getByText("WEB APPLICATION")).toBeInTheDocument();
    expect(screen.getByText("DATA STORE")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- tests/components/AttackSurfaceSceneV5.test.tsx`

Expected: FAIL because V5 component does not exist.

- [ ] **Step 3: Implement controller and poster-first handoff**

Controller responsibilities:

```ts
export type AttackSurfaceV5Controller = Readonly<{
  resize(width: number, height: number, dpr: number): void;
  setPointer(x: number, y: number): void;
  setVisible(visible: boolean): void;
  setPaused(paused: boolean): void;
  render(timeMs: number): void;
  dispose(): void;
  firstStableFrame: Promise<void>;
}>;
```

Use `WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })` for cinematic/balanced. Use `EffectComposer` + `UnrealBloomPass` only on tiers that enable bloom. Poster remains visible until `firstStableFrame` resolves, then crossfades away.

- [ ] **Step 4: Verify tests and typecheck**

Run: `npm test -- tests/components/AttackSurfaceSceneV5.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/landing/AttackSurfaceSceneV5.tsx components/landing/attack-surface-v5 tests/components/AttackSurfaceSceneV5.test.tsx
git commit -m "feat: add command center v5 scene lifecycle [skip ci]"
```

---

### Task 5: Replace V4 with separate desktop and mobile hero compositions

**Files:**
- Create: `components/landing/CommandCenterHeroDesktopV5.tsx`
- Create: `components/landing/CommandCenterHeroMobileV5.tsx`
- Modify: `components/landing/CommandCenterLandingHero.tsx`
- Create: `app/command-center-v5.css`
- Modify: `app/layout.tsx`
- Modify: `tests/components/CommandCenterLandingHero.test.tsx`

**Interfaces:**
- Produces: one responsive `CommandCenterLandingHero` selecting independently authored desktop/mobile DOM compositions.
- Consumes: `AttackSurfaceSceneV5` and shared illustrative telemetry content.

- [ ] **Step 1: Replace the old layout test with a failing V5 composition contract**

```tsx
it("exposes independently authored desktop and mobile compositions", () => {
  render(<CommandCenterLandingHero />);
  expect(screen.getByTestId("command-center-v5-desktop")).toBeInTheDocument();
  expect(screen.getByTestId("command-center-v5-mobile")).toBeInTheDocument();
});
```

Also retain checks that telemetry is labeled illustrative and primary actions remain real links.

- [ ] **Step 2: Run and confirm RED**

Run: `npm test -- tests/components/CommandCenterLandingHero.test.tsx`

Expected: FAIL because the V5 composition test IDs do not exist.

- [ ] **Step 3: Implement desktop composition**

Desktop structure must keep one first-viewport command-center composition:

```tsx
<section data-testid="command-center-v5-desktop" className="ccV5Desktop">
  <div className="ccV5DesktopCopy" />
  <div className="ccV5DesktopScene"><AttackSurfaceSceneV5 /></div>
  <div className="ccV5DesktopMetrics" />
  <div className="ccV5DesktopOverview" />
  <div className="ccV5DesktopRuntime" />
</section>
```

Use a fixed visual grid so headline, metric cards, risk overview, and scene share deliberate baselines. Do not copy V4 absolute label offsets or stack additional polish overrides.

- [ ] **Step 4: Implement separate mobile composition**

Mobile must make the scene the dominant visual anchor and use a different order/hierarchy rather than simply inheriting desktop grid areas. Use mobile-specific typography, scene crop/camera framing, metric density, and overview presentation.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- tests/components/CommandCenterLandingHero.test.tsx tests/components/AttackSurfaceSceneV5.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/landing/CommandCenterLandingHero.tsx components/landing/CommandCenterHeroDesktopV5.tsx components/landing/CommandCenterHeroMobileV5.tsx app/command-center-v5.css app/layout.tsx tests/components/CommandCenterLandingHero.test.tsx
git commit -m "feat: rebuild command center v5 compositions [skip ci]"
```

---

### Task 6: Remove the V4 visual override stack from the active page

**Files:**
- Modify: `app/layout.tsx`
- Remove active imports of: `app/command-center-v4.css`, `app/command-center-v4-polish.css`
- Retire from active hero: `components/landing/AttackSurfaceScene.tsx`
- Retire from active hero: `components/landing/attack-surface/*`
- Update tests that explicitly assert V4 scene version/naming.

**Interfaces:**
- Produces: a single active V5 landing visual path.
- Consumes: V5 implementation from Tasks 1-5.

- [ ] **Step 1: Add an architecture regression test**

Extend an existing architecture/style guard or create a focused test that reads `app/layout.tsx` and `CommandCenterLandingHero.tsx` and asserts the active landing path imports `command-center-v5.css`/`AttackSurfaceSceneV5` and does not import V4 visual styles/renderer.

- [ ] **Step 2: Run and confirm RED before removing V4 imports**

Run the focused architecture test.

Expected: FAIL while V4 imports remain active.

- [ ] **Step 3: Remove active V4 imports/references**

Do not delete historical design/spec documentation. Remove only active runtime imports/references and dead files when no tests or other pages consume them.

- [ ] **Step 4: Run focused tests plus full TypeScript**

Run: `npm test -- tests/components/CommandCenterLandingHero.test.tsx tests/components/AttackSurfaceSceneV5.test.tsx`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: retire rejected command center v4 visuals [skip ci]"
```

---

### Task 7: Perform real visual acceptance on desktop and iPhone-class mobile

**Files:**
- Create: `docs/development/COMMAND_CENTER_V5_VISUAL_ACCEPTANCE.md`
- Update: PR #49 body with V5 visual-gate state.

**Interfaces:**
- Produces: reviewable evidence tied to an exact commit and Vercel Preview deployment.
- Consumes: completed V5 branch head.

- [ ] **Step 1: Run software acceptance before spending a deployment**

Run:

```bash
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js --version
npm run benchmark:scanner
npm audit --audit-level=info
npm run build
```

Expected: all pass on the same candidate SHA.

- [ ] **Step 2: Deploy exactly that candidate SHA to Vercel Preview**

Do not burn multiple deployments for cosmetic guesses. Deploy only after local/software acceptance is green.

- [ ] **Step 3: Capture deliberate desktop visual review**

Review at approximately 1440×900 or equivalent desktop viewport. Compare against the approved reference for:

- central scene dominance and density;
- headline and copy alignment;
- integrated metric/risk/runtime composition;
- mesh depth, glow, risk paths, towers, and node readability;
- absence of V4-like sparse line-art appearance;
- no overlap or clipping at common desktop widths.

- [ ] **Step 4: Capture deliberate mobile visual review**

Review at approximately 430×932 on Mobile Safari/iPhone-class viewport. Confirm:

- scene remains crisp and volumetric;
- mobile composition is independently art-directed;
- no text/card overlap or floating outside boundaries;
- no jagged low-DPR wireframe appearance;
- labels remain readable without dominating the scene;
- scrolling into the next section has intentional spacing.

- [ ] **Step 5: Record exact evidence**

`COMMAND_CENTER_V5_VISUAL_ACCEPTANCE.md` must include exact commit SHA, Preview URL/deployment ID, viewport classes, reviewer findings, any accepted deviations from the concept, and explicit PASS/FAIL for desktop and mobile.

- [ ] **Step 6: If either viewport fails, keep PR draft and return to the relevant implementation task**

Do not mark the UI accepted based only on tests/builds.

- [ ] **Step 7: Commit acceptance evidence only after PASS**

```bash
git add docs/development/COMMAND_CENTER_V5_VISUAL_ACCEPTANCE.md
git commit -m "docs: record command center v5 visual acceptance [skip ci]"
```

---

### Task 8: Final PR #49 release review

**Files:**
- Update: PR #49 title/body as needed.
- No unrelated source changes.

**Interfaces:**
- Produces: a V5-ready draft/ready-for-review decision.
- Consumes: exact software and visual acceptance evidence.

- [ ] **Step 1: Review the complete PR diff against `main`**

Confirm no backend authority, Supabase, runtime-worker, scanner, Phase 6D, or hosted-gate changes entered the UI PR.

- [ ] **Step 2: Recheck dependency delta**

Confirm Three.js is the only new runtime dependency and audit remains acceptable.

- [ ] **Step 3: Recheck unresolved PR review threads and Vercel state**

No unresolved blocker may remain.

- [ ] **Step 4: Update PR description**

Replace the old V4 acceptance claim with V5 exact-head software acceptance, V5 visual evidence, dependency/security boundary statement, and remaining deployment caveats.

- [ ] **Step 5: Only then consider PR #49 visually accepted**

Do not merge solely because automated checks are green. The visual evidence document must record PASS for both desktop and mobile.
