# Living Attack Surface UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ScopeForge's generic security SaaS presentation with the approved Living Attack Surface visual system and original Forge Aperture brand while preserving all existing security, auth, data, and runtime boundaries.

**Architecture:** Keep the application server-rendered by default. Build the brand as reusable SVG React components, isolate visual-only interactivity inside small client components, keep all existing dashboard data queries and authorization code unchanged, and use CSS/SVG as the first production renderer instead of adding Three.js. The landing page gets the most immersive visual treatment while authenticated pages inherit the same design tokens with lower motion and higher information density.

**Tech Stack:** Next.js 15.5.24, React 19.1, TypeScript 5.8, Lucide React, CSS, SVG, Supabase SSR, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-30-living-attack-surface-ui-design.md`

## Global Constraints

- Do not use, trigger, rerun, or depend on GitHub Actions.
- Every repository commit must include `[skip ci]`.
- Preserve all existing Supabase authorization behavior, RLS semantics, asset verification, findings lifecycle, repository runtime capability gates, and Phase 6D design gate.
- Keep `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED = false` and `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED = false`.
- Turnstile remains inactive and must not be represented as active.
- No fabricated live platform telemetry. Synthetic landing values must be labeled as illustration.
- Prefer CSS/SVG and lightweight interaction. Do not add a Three.js dependency in this implementation.
- Respect `prefers-reduced-motion: reduce`.
- Maintain keyboard focus visibility and WCAG AA contrast for body copy and controls.
- The authenticated dashboard must continue using the current real workspace queries.
- No security workflow logic change is part of this plan.

---

## File map

### New files

- `components/brand/ScopeForgeMark.tsx` - reusable Forge Aperture SVG mark with decorative and labeled modes.
- `components/brand/ScopeForgeWordmark.tsx` - mark plus ScopeForge text lockup.
- `components/landing/PublicNav.tsx` - responsive floating landing navigation.
- `components/landing/LivingAttackSurface.tsx` - SVG attack-surface illustration with semantic demo labeling and lightweight pointer response.
- `components/landing/LandingMetricStrip.tsx` - clearly illustrative landing concepts, not live production totals.
- `app/icon.svg` - app/fav icon using the same Forge Aperture geometry.
- `tests/brand/scopeforge-mark.test.tsx` - brand accessibility and SVG contract tests.
- `tests/landing/living-attack-surface.test.tsx` - visual component semantic/fallback tests.

### Modified files

- `app/page.tsx` - replace the current split-card landing hero with Living Attack Surface composition.
- `components/AppShell.tsx` - replace generic ShieldCheck branding and refresh shell structure without route/auth changes.
- `app/dashboard/page.tsx` - recompose dashboard using the same existing data queries and actions.
- `app/layout.tsx` - metadata/icon wiring and brand description refinement.
- `app/globals.css` - new visual tokens, public layout, app shell, dashboard, responsive rules, and reduced-motion behavior.

---

### Task 1: Forge Aperture brand system

**Files:**
- Create: `components/brand/ScopeForgeMark.tsx`
- Create: `components/brand/ScopeForgeWordmark.tsx`
- Create: `app/icon.svg`
- Create: `tests/brand/scopeforge-mark.test.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `ScopeForgeMark({ size?: number, className?: string, title?: string })`
- Produces: `ScopeForgeWordmark({ compact?: boolean, className?: string })`
- Later tasks consume both components in landing navigation and `AppShell`.

- [ ] **Step 1: Add failing brand component tests**

Create `tests/brand/scopeforge-mark.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ScopeForgeMark from "@/components/brand/ScopeForgeMark";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";

describe("ScopeForge brand", () => {
  it("renders a labeled mark when title is provided", () => {
    render(<ScopeForgeMark title="ScopeForge" />);
    expect(screen.getByRole("img", { name: "ScopeForge" })).toBeInTheDocument();
  });

  it("hides the mark from assistive technology when no title is provided", () => {
    const { container } = render(<ScopeForgeMark />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the ScopeForge wordmark text", () => {
    render(<ScopeForgeWordmark />);
    expect(screen.getByText("ScopeForge")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npm test -- --run tests/brand/scopeforge-mark.test.tsx
```

Expected: FAIL because the brand components do not exist.

- [ ] **Step 3: Implement the SVG mark and wordmark**

`components/brand/ScopeForgeMark.tsx` must use original vector geometry only. Use four segmented outer arcs, four short scope ticks, a restrained shield path, and a four-point ember spark. Do not depend on SVG filters or raster images.

Required component shape:

```tsx
export default function ScopeForgeMark({
  size = 34,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  const labelled = Boolean(title);
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      {labelled ? <title>{title}</title> : null}
      <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
        <path d="M13 27A20 20 0 0 1 27 13" />
        <path d="M37 13A20 20 0 0 1 51 27" />
        <path d="M51 37A20 20 0 0 1 37 51" />
        <path d="M27 51A20 20 0 0 1 13 37" />
        <path d="M32 7v8M32 49v8M7 32h8M49 32h8" />
      </g>
      <path className="forgeShield" d="M32 19 43 23v9c0 8-4.7 13.2-11 16-6.3-2.8-11-8-11-16v-9l11-4Z" />
      <path className="forgeSpark" d="m32 22 2.5 7.5L42 32l-7.5 2.5L32 42l-2.5-7.5L22 32l7.5-2.5L32 22Z" />
    </svg>
  );
}
```

`ScopeForgeWordmark.tsx` must render the mark plus plain text `ScopeForge`, so typography remains accessible and responsive rather than converting the company name to paths.

- [ ] **Step 4: Add the matching application icon**

Create `app/icon.svg` with a 64x64 square viewBox, graphite background, teal/cyan segmented aperture, dark shield, and ember spark using the same geometry as the React mark. Keep it legible without gradients.

- [ ] **Step 5: Wire application metadata**

Update `app/layout.tsx` metadata to include:

```ts
icons: {
  icon: "/icon.svg",
  shortcut: "/icon.svg",
  apple: "/icon.svg",
},
```

Do not change auth, Supabase, or runtime logic.

- [ ] **Step 6: Run focused test and typecheck**

```bash
npm test -- --run tests/brand/scopeforge-mark.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/brand app/icon.svg app/layout.tsx tests/brand/scopeforge-mark.test.tsx
git commit -m "Add Forge Aperture brand system [skip ci]"
```

---

### Task 2: Public navigation and Living Attack Surface renderer

**Files:**
- Create: `components/landing/PublicNav.tsx`
- Create: `components/landing/LivingAttackSurface.tsx`
- Create: `components/landing/LandingMetricStrip.tsx`
- Create: `tests/landing/living-attack-surface.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `ScopeForgeMark`, `ScopeForgeWordmark` from Task 1.
- Produces: `PublicNav`, `LivingAttackSurface`, and `LandingMetricStrip` for `app/page.tsx`.

- [ ] **Step 1: Write failing semantic tests**

Create `tests/landing/living-attack-surface.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LivingAttackSurface from "@/components/landing/LivingAttackSurface";
import LandingMetricStrip from "@/components/landing/LandingMetricStrip";

describe("Living Attack Surface", () => {
  it("describes the illustration without claiming live telemetry", () => {
    render(<LivingAttackSurface />);
    expect(screen.getByRole("img", { name: /illustrative attack surface/i })).toBeInTheDocument();
    expect(screen.getByText(/product illustration/i)).toBeInTheDocument();
  });

  it("labels synthetic landing metrics as illustrative", () => {
    render(<LandingMetricStrip />);
    expect(screen.getByText(/illustrative platform view/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Confirm RED**

```bash
npm test -- --run tests/landing/living-attack-surface.test.tsx
```

Expected: FAIL because the landing components do not exist.

- [ ] **Step 3: Implement `LivingAttackSurface` as a lightweight client component**

Use `"use client"` only in this file. The component must render one semantic wrapper with `role="img"`, a hidden text description, a central Forge Aperture node, and seven radial domain nodes:

```ts
const nodes = [
  { id: "web", label: "Web App", x: 18, y: 38, state: "risk" },
  { id: "api", label: "API", x: 31, y: 18, state: "healthy" },
  { id: "repo", label: "Repository", x: 55, y: 12, state: "healthy" },
  { id: "cloud", label: "Cloud", x: 79, y: 24, state: "healthy" },
  { id: "third", label: "Third Party", x: 88, y: 52, state: "observe" },
  { id: "data", label: "Data Store", x: 72, y: 82, state: "risk" },
  { id: "identity", label: "Identity", x: 35, y: 84, state: "healthy" },
] as const;
```

Pointer interaction may set CSS custom properties `--surface-x` and `--surface-y` from normalized pointer position. The component must not request device motion permission, make network calls, or alter application state.

- [ ] **Step 4: Implement floating public navigation**

`PublicNav` must include:

- ScopeForge wordmark
- links to `#platform`, `#security-model`, GitHub community URL
- Sign in
- Create account
- accessible mobile details/menu behavior using native semantic controls, with no new dependency

Do not add Pricing or Company links.

- [ ] **Step 5: Implement illustrative metric strip**

Render four concept cards named `Verified scope`, `Findings`, `Risk paths`, and `Authorization`. Use restrained example values and include visible text `Illustrative platform view` so the values cannot be mistaken for live production totals.

- [ ] **Step 6: Add visual tokens and renderer CSS**

Extend `app/globals.css` with the approved palette:

```css
:root {
  --forge-bg: #070a0d;
  --forge-surface: #0b1015;
  --forge-surface-2: #101820;
  --forge-line: rgba(150, 176, 187, .16);
  --forge-text: #f4f7f8;
  --forge-muted: #88939f;
  --forge-teal: #4fe0c1;
  --forge-cyan: #55c7df;
  --forge-ember: #ff8a3d;
}
```

Add a bounded illustration area with `contain: layout paint`, `pointer-events` limited to the illustration, no continuous camera animation, and reduced-motion overrides:

```css
@media (prefers-reduced-motion: reduce) {
  .attackSurface *,
  .attackSurface *::before,
  .attackSurface *::after {
    animation: none !important;
    transition-duration: .01ms !important;
  }
}
```

- [ ] **Step 7: Run focused tests and typecheck**

```bash
npm test -- --run tests/landing/living-attack-surface.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/landing app/globals.css tests/landing/living-attack-surface.test.tsx
git commit -m "Build Living Attack Surface visual components [skip ci]"
```

---

### Task 3: Recompose the public landing page

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `PublicNav`, `LivingAttackSurface`, `LandingMetricStrip`.
- Keeps existing public routes `/auth/sign-in` and `/auth/sign-up`.

- [ ] **Step 1: Replace generic landing structure**

`app/page.tsx` must render this high-level structure:

```tsx
<main className="forgeLanding">
  <PublicNav />
  <section className="forgeHero">
    <div className="forgeHeroCopy">...</div>
    <LivingAttackSurface />
    <LandingMetricStrip />
  </section>
  <section id="platform" className="forgePlatform">...</section>
  <section id="security-model" className="forgeSecurityModel">...</section>
</main>
```

Use the current message `Understand the risk before it becomes an incident.` and keep `Start a workspace` plus the GitHub/community CTA. Replace generic feature-card copy with ScopeForge's actual security model: Discover, Validate, Explain, Connect, Prepare, Fix, Verify.

- [ ] **Step 2: Add Sylva-inspired composition without copying artwork**

CSS requirements:

- floating rounded navigation dock
- large editorial headline
- final phrase uses forged teal gradient or solid accent
- subtle structural grid lines
- large illustration extending behind/right of copy on desktop
- mobile composition becomes single-column
- no large raster hero artwork

- [ ] **Step 3: Preserve clear authorization language**

The public page must continue displaying a visible statement equivalent to:

```text
For systems you own or are explicitly authorized to assess.
```

Do not soften or bury this statement.

- [ ] **Step 4: Run typecheck and build**

```bash
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/globals.css
git commit -m "Recompose ScopeForge public landing experience [skip ci]"
```

---

### Task 4: Refresh authenticated app shell

**Files:**
- Modify: `components/AppShell.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `ScopeForgeWordmark`.
- Must preserve props exactly: `{ children, displayName, workspaceName, role }`.
- Must preserve `SideNav`, sign-out action, roadmap route, and role/workspace presentation.

- [ ] **Step 1: Replace generic brand icon**

Remove `ShieldCheck` from the branding import and render:

```tsx
<Link className="brand sideBrand" href="/">
  <ScopeForgeWordmark compact />
</Link>
```

Do not change sign-out server action wiring.

- [ ] **Step 2: Recompose shell surfaces**

Keep the existing sidebar and sticky top bar architecture, but add an inner `topbarDock` container and refined class structure so CSS can create a floating glass effect. Do not add unavailable user settings or runtime controls.

- [ ] **Step 3: Add shell CSS**

Implement:

- graphite sidebar
- subtle inner border
- active side nav teal edge rather than wide fill
- elevated topbar dock
- compact workspace chip
- clear focus-visible states
- mobile behavior must continue to fit without horizontal overflow

- [ ] **Step 4: Run typecheck and existing navigation tests**

```bash
npm run typecheck
npm test -- --run
```

Expected: existing suite remains green.

- [ ] **Step 5: Commit**

```bash
git add components/AppShell.tsx app/globals.css
git commit -m "Refresh authenticated ScopeForge shell [skip ci]"
```

---

### Task 5: Recompose dashboard around real workspace data

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Keep `getDashboardContext()` unchanged.
- Keep the existing Supabase queries unchanged in semantics and filters.
- Keep existing `nextHref`, `nextTitle`, `nextCopy`, and `nextActionLabel` decision logic.

- [ ] **Step 1: Preserve the server data section exactly in responsibility**

Do not move dashboard queries client-side. Continue loading:

```ts
supabase
  .from("assets")
  .select("id,verification_status,created_at")
  .eq("workspace_id", workspace.id)
  .order("created_at", { ascending: true });
```

and the existing counted query for open `security_findings` lifecycle states.

- [ ] **Step 2: Recompose the render tree**

Use this order:

```tsx
<section className="pageHeader forgeDashboardHeader">...</section>
<section className="grid4 forgeStatBand">...</section>
<section className="dashboardHeroGrid">
  <article className="attackOverviewCard">...</article>
  <section className="nextAction forgeCommandCard">...</section>
</section>
<section className="dashboardGrid" id="phase-roadmap">...</section>
```

The `attackOverviewCard` must use only real current counts from `totalAssets`, `verifiedAssets.length`, and `openWorkCount`. It may visually represent relationships, but it must not invent risk counts or pretend runtime workers are enabled.

- [ ] **Step 3: Update dashboard visual status language**

Do not use a generic `Runtime ledger active` statement if it implies unavailable hosted repository runtime. Use a precise status such as:

```text
Evidence ledger ready
```

Keep the hosted repository capabilities visibly unavailable wherever existing UI already communicates that state.

- [ ] **Step 4: Add responsive dashboard CSS**

Desktop: two-column overview, four-stat band.
Tablet: two-stat columns and bounded overview.
Mobile: one-column cards, no clipped charts, no hover-only information.

- [ ] **Step 5: Run full tests, typecheck, and production build**

```bash
npm test -- --run
npm run typecheck
npm run build
```

Expected: PASS with no change in dashboard query behavior.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/page.tsx app/globals.css
git commit -m "Recompose dashboard with Living Attack Surface UI [skip ci]"
```

---

### Task 6: Accessibility, responsive, and security-boundary regression pass

**Files:**
- Modify: `app/globals.css`
- Modify only if needed from inspection: `components/landing/PublicNav.tsx`, `components/landing/LivingAttackSurface.tsx`, `components/AppShell.tsx`, `app/page.tsx`, `app/dashboard/page.tsx`

**Interfaces:**
- No new product capability.
- Produces the final merge candidate.

- [ ] **Step 1: Verify keyboard and focus contracts in source**

Every link/button added in this feature must remain a native interactive element and receive a visible `:focus-visible` treatment. No clickable `div` elements.

- [ ] **Step 2: Verify reduced-motion source behavior**

Confirm all continuous decorative animation classes used by the attack-surface visual are disabled by the existing reduced-motion media query.

- [ ] **Step 3: Verify mobile CSS constraints**

Ensure at widths below 720px:

```css
.forgeHero,
.dashboardHeroGrid,
.grid4,
.dashboardGrid {
  grid-template-columns: 1fr;
}
```

and no fixed pixel width forces horizontal scrolling.

- [ ] **Step 4: Run exact-candidate verification outside GitHub Actions**

Run against the exact feature head:

```bash
npm ci
npm run typecheck
npm test -- --run
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
NODE_ENV=production npm run build
npm audit --json
```

Expected:

- install passes
- typecheck passes
- all tests pass
- CLI build/version passes
- scanner benchmark completes with zero errors
- production Next.js build passes
- npm audit reports zero vulnerabilities at all severities

- [ ] **Step 5: Security regression review**

Confirm diff contains no changes to:

- Supabase migrations
- RLS policies
- server authorization logic
- repository worker task contracts
- repository acquisition/scanning runtime flags
- network execution behavior
- Phase 6D design or implementation

- [ ] **Step 6: Commit any final polish**

```bash
git add app components tests
git commit -m "Polish responsive and accessible ScopeForge UI [skip ci]"
```

Skip this commit if no files changed.

---

### Task 7: PR review, production verification, and branch reconciliation

**Files:**
- No code changes unless review identifies a defect.

**Interfaces:**
- Consumes the exact verified feature head from Task 6.
- Produces reviewed `main` and a healthy Vercel production deployment.

- [ ] **Step 1: Open a dedicated PR**

PR must summarize:

- Forge Aperture brand
- public Living Attack Surface experience
- app shell/dashboard refresh
- no security-authority changes
- exact local verification results
- no GitHub Actions use

- [ ] **Step 2: Review the complete PR diff**

Check for:

- accidental security/control-plane changes
- fabricated telemetry
- accessibility regressions
- responsive layout risks
- unnecessary dependency additions
- copied ThreeUI/Sylva source or artwork

Expected: no copied Sylva assets/source and no new dependency required for the renderer.

- [ ] **Step 3: Merge only the exact reviewed head**

Use expected-head protection if available. Merge commit message must contain `[skip ci]`.

- [ ] **Step 4: Verify Vercel deployment**

After Vercel's Git integration deploys the merge commit, confirm:

- deployment state `READY`
- `https://scopeforge.dev/` returns 200
- `/auth/sign-in` returns 200
- unauthenticated `/dashboard` still reaches the sign-in flow
- no new runtime errors
- custom domain remains attached and healthy

- [ ] **Step 5: Verify Supabase advisor and runtime gates**

Confirm the production Supabase security advisor remains clean and both repository runtime capability flags remain disabled.

- [ ] **Step 6: Reconcile feature branch**

Compare `main...feat/living-attack-surface-ui`. Delete the feature branch only when `ahead_by = 0` after merge. Preserve it if comparison fails or unique work remains.
