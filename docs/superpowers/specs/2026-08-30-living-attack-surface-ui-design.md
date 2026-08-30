# ScopeForge Living Attack Surface UI Design

Date: 2026-08-30
Status: Approved visual direction, design specification

## Goal

Refresh ScopeForge's public landing page and authenticated dashboard around an original premium security visual system inspired by the composition and polish of ThreeUI's Sylva example, without copying Sylva-specific artwork, source, branding, or licensed visual assets.

The approved direction is **Living Attack Surface** with the **Forge Aperture** logo identity.

The UI must continue to communicate ScopeForge's safety model clearly: authorized scope first, evidence before inference, and bounded security testing. Visual polish must not obscure operational state or security controls.

## Design principles

1. **Security tool first, visual experience second.** The authenticated application remains fast to scan, readable, and data-dense. The most immersive visual treatment belongs on the public landing page and a bounded dashboard overview surface.
2. **Original visual language.** Recreate the structural qualities the user liked in Sylva, such as large editorial typography, negative space, floating controls, layered depth, subtle grid structure, and responsive motion, while using ScopeForge-specific geometry and security semantics.
3. **Progressive enhancement.** Core navigation, metrics, findings, asset state, and actions work without WebGL. Rich animation enhances the experience when supported.
4. **Respect reduced motion and constrained devices.** `prefers-reduced-motion`, mobile GPU limitations, low-power devices, and server-rendered fallback states must remain usable and attractive.
5. **No fabricated security telemetry.** Production dashboard values continue to come from existing ScopeForge data. Decorative landing-page examples must be clearly visual/demo content rather than appearing to be live workspace telemetry.

## Brand identity

### Forge Aperture mark

Create an original vector logo composed from three ideas:

- an outer segmented aperture/scope ring representing inspection and scope;
- a restrained inner shield silhouette representing defense and authorization boundaries;
- a four-point central forge spark representing transformation of evidence into action.

The icon must remain recognizable at 16px and must not depend on gradients for legibility.

Required variants:

- `scopeforge-mark.svg` - icon-only primary mark;
- `scopeforge-mark-mono.svg` - single-currentColor version suitable for monochrome contexts;
- `scopeforge-wordmark.svg` - horizontal mark plus ScopeForge wordmark where useful;
- generated application icons from the same geometry for favicon/app metadata.

Primary brand palette:

- graphite black: `#070A0D` / `#0B1015`;
- forged teal: approximately `#4FE0C1`;
- cool cyan: approximately `#55C7DF`;
- forge ember: approximately `#FF8A3D`;
- primary text: near-white `#F4F7F8`;
- muted text: cool gray in the `#88939F` range.

The ember color is a focused risk/action accent, not a general-purpose brand fill.

## Public landing page

### Composition

Desktop hero uses a two-zone composition rather than a conventional SaaS card split:

- left: editorial headline, short explanatory copy, primary CTA, secondary CTA, and compact evidence/mission metrics;
- right and lower center: the Living Attack Surface visual, extending behind the composition to create depth;
- floating top navigation in a rounded translucent dock;
- thin structural guide lines and labels establish a technical, spatial feel.

Headline remains centered on ScopeForge's current message:

`Understand the risk before it becomes an incident.`

The line break and scale should make the final phrase visually distinctive using the forged-teal family rather than a loud neon treatment.

### Living Attack Surface visual

Build an original procedural/structured visual representing a workspace attack surface:

- central Forge Aperture node;
- 5 to 7 radial paths leading to security domains such as Web App, API, Repository, Identity, Data Store, Cloud, and Third Party;
- mostly healthy teal/cyan geometry;
- one or two ember-highlighted risk paths;
- subtle wireframe topology and point particles;
- restrained pulse/scanner motion;
- pointer or device-tilt parallax on capable devices;
- no automatic camera movement that compromises reading.

The first implementation may use layered SVG/CSS/canvas rather than full Three.js if that achieves the approved visual with materially lower bundle/runtime cost. A later WebGL enhancement is allowed only if measurements justify it.

### Landing metrics

Show compact illustrative platform concepts such as:

- verified scope;
- findings;
- risk paths;
- authorization state.

Public landing metrics must be labeled as product illustration where values are synthetic. Do not present mock numbers as live ScopeForge platform totals.

### Navigation

Desktop uses a floating rounded dock similar in composition to the approved mockup, with ScopeForge branding on the left and concise links/actions on the right.

Recommended public entries:

- Platform
- Security model
- Community
- GitHub
- Sign in
- Create account

Do not add fake Pricing or Company sections merely to imitate a commercial template.

Mobile reduces this into a compact brand/header row plus an accessible menu sheet. Do not squeeze desktop navigation into a narrow viewport.

## Authenticated application shell

The existing `AppShell` and routes remain the navigation architecture. The refresh changes presentation, not authorization or routing semantics.

### Sidebar

- Replace generic Lucide `ShieldCheck` branding with Forge Aperture.
- Use deeper glass/graphite surfaces with a subtle inner border.
- Active navigation receives a restrained teal edge/glow rather than a broad filled highlight.
- Workspace identity remains clearly visible.
- Preserve sign-out and role information.

### Top bar

Use a floating/pill-like inner bar on wide screens while preserving sticky behavior. Display workspace context, runtime status/capability state, and user controls without inventing unavailable features.

### Dashboard overview

Retain current real data and server-side queries for:

- registered assets;
- verified assets;
- open findings;
- workspace/RLS state;
- next recommended action.

Recompose the page around:

1. an editorial overview header;
2. a compact 4-stat band;
3. a primary `Attack Surface Overview` visual card using real workspace counts where possible;
4. `Next action` as a high-priority command card;
5. product/security modules and execution guardrails below.

No security workflow logic changes are part of this UI phase.

## Motion and interaction

Motion should feel physical and deliberate rather than decorative.

Allowed:

- subtle 150ms to 300ms hover/press transitions;
- staggered hero reveal;
- gentle attack-surface node pulses;
- low-amplitude pointer parallax;
- focused ember path animation for risk emphasis;
- panel sheen or border response on pointer-capable devices.

Disallowed:

- continuous high-amplitude background motion;
- flashing threat effects;
- autoplay motion that competes with findings or form fields;
- motion required to understand state.

For `prefers-reduced-motion: reduce`, disable parallax, path travel, staggered transitions, and continuous decorative animation.

## Responsive behavior

### Desktop

Use the full spatial hero and large attack-surface illustration. Dashboard retains sidebar navigation.

### Tablet

Reduce hero visual complexity and avoid overlapping important copy. Dashboard grid becomes two-column where appropriate.

### Mobile

- single-column landing composition;
- logo and menu remain compact;
- attack-surface visual becomes a bounded static/lightly animated SVG illustration below the headline;
- dashboard sidebar collapses to the existing mobile navigation pattern or a dedicated accessible menu;
- cards must preserve readable labels before decorative effects.

## Accessibility

- Maintain WCAG AA contrast for body copy and controls.
- Logo SVG includes accessible brand labeling where used as meaningful content and is hidden from screen readers when adjacent wordmark text already names ScopeForge.
- All animated information has a static equivalent.
- Keyboard focus states remain stronger than hover states.
- No canvas-only critical navigation or dashboard telemetry.
- Use semantic HTML for stats, headings, navigation, and actions.

## Performance budget

The visual refresh must not make the dashboard dependent on a heavy 3D runtime.

Initial target:

- prefer SVG/CSS and lightweight client interaction for the first production version;
- keep the landing visualization isolated into a client component so the rest of the page remains server-renderable;
- lazy-load any optional advanced renderer after primary content;
- no WebGL dependency in authenticated findings/assets pages;
- avoid large raster hero artwork as the primary implementation;
- test on mobile Safari and Chromium responsive emulation.

If a Three.js renderer is later introduced, it must be dynamically loaded, have a static fallback, and be justified by measured visual/performance benefit.

## Architecture and files

Expected implementation boundaries:

- `components/brand/ScopeForgeMark.tsx` - reusable vector mark;
- `components/brand/ScopeForgeWordmark.tsx` - optional horizontal lockup;
- `components/landing/LivingAttackSurface.tsx` - isolated interactive visual;
- `components/landing/PublicNav.tsx` - floating public navigation;
- `components/AppShell.tsx` - adopt new brand and shell styling without changing route/auth semantics;
- `app/page.tsx` - new landing composition;
- `app/dashboard/page.tsx` - dashboard overview composition using existing data;
- `app/globals.css` and focused component CSS - design tokens, layout, responsive and motion rules;
- `app/layout.tsx` plus icon assets - favicon/application branding metadata.

Prefer small focused components rather than placing the complete visual implementation in `app/page.tsx`.

## Data and security boundaries

This redesign must not change:

- Supabase authorization behavior;
- RLS policy semantics;
- asset verification requirements;
- findings lifecycle logic;
- repository runtime capability gates;
- network-worker behavior;
- Phase 6D design gate.

`HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` and `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED` remain false unless separately approved under their existing architecture process.

Turnstile must continue to be described as inactive until it is actually wired and verified.

## Testing and acceptance

Required verification before merge:

- `npm run typecheck`;
- relevant Vitest coverage for interactive UI logic that has non-trivial behavior;
- `npm run build`;
- no GitHub Actions usage;
- all repository commits include `[skip ci]`;
- desktop and mobile visual inspection;
- keyboard navigation check;
- reduced-motion check;
- landing page and sign-in continue returning successfully;
- authenticated dashboard still uses real existing workspace queries;
- no changes to Phase 6D worker behavior.

Visual acceptance criteria:

- Forge Aperture is clearly recognizable and replaces the generic shield-check branding;
- landing page reads as ScopeForge rather than a generic SaaS template;
- the composition captures the spacious, layered, premium feeling of the approved Sylva reference without copying its artwork;
- dashboard feels visually related to the landing page while remaining operationally clear;
- mobile remains polished rather than merely stacked desktop UI.

## Implementation sequence

1. Brand tokens and Forge Aperture vector system.
2. Public navigation and landing layout.
3. Living Attack Surface renderer and reduced-motion/static fallback.
4. AppShell visual refresh.
5. Dashboard overview recomposition using existing real data.
6. Responsive/accessibility refinement.
7. Local typecheck, tests, build, security-boundary regression review.
8. Review through a dedicated `[skip ci]` PR and merge only after exact-head verification without GitHub Actions.
