# ScopeForge Command Center UI v4 Design

Date: 2026-08-30
Status: Approved direction
Target: Public landing experience and visual system only

## Goal

Rebuild the ScopeForge public experience so it matches the approved command-center concept much more closely while remaining responsive, functional, secure, and performant.

The current v3 composition established the correct broad direction but still has four major problems:

1. Desktop and mobile share too much positioning logic, causing collisions, overlap, and elements escaping their intended regions.
2. The public navigation includes decorative links that look like product controls but do not correspond to real product destinations.
3. The 3D scene is visually simpler than the ThreeUI Sylva reference and does not yet deliver the depth, motion, material quality, and animation density expected from the approved concept.
4. Important telemetry typography is undersized and the hierarchy is inconsistent across viewports.

The v4 redesign must solve those problems structurally rather than by adding more absolute-position offsets.

## Visual Target

The approved 1536 x 864 command-center render remains the master desktop reference for composition, spacing, lighting, color, and hierarchy.

The design target is not a static screenshot. The final experience must preserve the visual identity of the render while implementing the right-hand centerpiece as a real animated 3D attack-surface scene.

Primary visual characteristics:

- deep graphite and near-black background
- teal and cyan illumination for healthy or verified states
- orange and red illumination for risky states
- thin structural grid
- dark translucent panels with subtle internal highlights
- oversized editorial hero copy on the left
- compact, readable metrics beneath it
- dense dimensional attack-surface object occupying the right half
- low-amplitude atmospheric particles and scan motion
- restrained bloom and emissive glow rather than saturated neon
- large negative space with strict alignment

## Responsive Architecture

The application must have two intentional primary compositions rather than one desktop layout that simply wraps.

### Desktop composition

Target range: 1024px and above, with the 1536 x 864 viewport as the master reference.

The first viewport is divided into explicit layout regions:

- top navigation rail
- left editorial column
- left metric band
- lower-left attack-surface overview panel
- right 3D scene region
- lower-right runtime status rail

The 3D scene receives a dedicated bounded region and cannot overlap the left editorial or metric areas. Labels around the 3D scene are positioned inside the renderer region and clamped to its bounds.

Absolute positioning is allowed only inside these controlled regions. Page-level placement must use grid/flex tracks and explicit min/max dimensions.

### Mobile composition

Target range: below 768px.

Mobile is a separate composition with its own order and sizing:

1. compact ScopeForge header
2. Living Attack Surface eyebrow
3. hero headline
4. hero description
5. primary actions
6. compact metric band with larger numbers
7. dedicated mobile 3D scene viewport
8. compact runtime/status row
9. Attack Surface Overview card
10. remaining public product sections

The 3D scene remains visible and important, but its geometry density, camera framing, label count, particle count, bloom strength, and device pixel ratio are reduced.

No major panel may overflow the viewport width. Horizontal scrolling is not allowed.

### Tablet composition

Between mobile and desktop, use a controlled intermediate layout rather than relying on wrap behavior.

The scene occupies a full-width upper-right or centered region, while editorial content and metrics remain in a two-track grid where space allows.

## Navigation

The public navigation must stop presenting placeholder anchors as if they were real product destinations.

### Signed-out public navigation

Desktop:

- ScopeForge home
- Product - scrolls to the actual public product workflow section
- Security model - scrolls to the real security model section
- GitHub - opens the ScopeForge repository
- Sign in - `/auth/sign-in`
- Create workspace - `/auth/sign-up`

Mobile:

- same destinations in a compact disclosure menu

Do not show Pricing, Company, or Use Cases until ScopeForge has dedicated destinations for those concepts.

### Authenticated navigation

Authenticated application navigation remains functional and product-oriented:

- Dashboard
- Assets
- Findings
- Add asset
- Project/GitHub where appropriate
- account/sign out controls
- Settings only when a real settings destination exists

No header control should be purely decorative.

## 3D Scene Architecture

The current lightweight raw-WebGL visual is replaced with a proper Three.js scene.

The scene remains an original ScopeForge asset, inspired by the motion quality and responsiveness of ThreeUI Sylva without copying Sylva's protected artwork.

### Scene structure

The scene contains:

- central Forge Aperture core
- layered concentric mechanical rings
- six branching attack-surface arms
- structural truss geometry
- semi-transparent glass or wireframe plates
- elevated endpoint towers and cuboid infrastructure clusters
- teal healthy paths
- cyan verified paths
- orange and red risk routes
- moving scan pulses
- low-density data particles
- subtle environment haze
- floating telemetry markers

### Materials

Use a physically based material stack where practical:

- dark metallic surfaces with low roughness highlights
- transparent glass panels with limited transmission
- wireframe overlays for structural detail
- emissive teal/cyan channels
- emissive orange/red risk channels
- restrained bloom post-processing

Materials must remain readable on OLED mobile screens and should not crush all dark detail into black.

### Motion

Motion must be sophisticated but low amplitude:

- slow camera drift
- pointer-driven parallax on desktop
- subtle hub rotation
- independent low-speed ring movement
- scan pulses moving along selected paths
- occasional branch activation shimmer
- particle drift
- slow endpoint signal pulses
- subtle risk-path breathing glow

No high-frequency or constantly accelerating motion.

### Performance tiers

High quality desktop:

- full geometry detail
- full particle budget
- bloom enabled
- highest allowed DPR cap

Balanced desktop/tablet:

- reduced geometry subdivisions
- reduced particle count
- reduced bloom quality

Mobile:

- simplified tower meshes
- reduced transparent surfaces
- lower particle count
- reduced DPR cap
- fewer simultaneous animated paths

Reduced motion:

- static or nearly static camera
- no travelling pulses
- no continuous ring motion
- preserve clear visual states

WebGL unavailable:

- render the existing DOM/SVG fallback without blocking the rest of the page

## Cold-Load Boot Experience

Use loading strategy A: show the initialization screen only when the graphics payload is not already warm in browser cache.

### First or cold visit

Show a short ScopeForge boot screen with:

- Forge Aperture animation
- greeting or neutral welcome copy
- `Preparing living attack surface`
- actual percentage progress tied to known graphics asset loading
- browser/WebGL capability check
- scene/material preparation state

The percentage must represent real tracked asset progress where possible. Do not run a fake timer to 100%.

### Warm repeat visit

If the required scene payload is already available or can initialize within a short threshold, skip the full loader and enter the site immediately.

### Cloudflare wording

Do not display a fake `Cloudflare security check`.

Turnstile is currently inactive. The loader may truthfully say:

- Checking browser capabilities
- Preparing secure session
- Initializing renderer
- Loading attack-surface model

If a real Cloudflare challenge is later introduced, it may be represented only when that challenge is genuinely running.

## Asset Loading and Cache Strategy

Do not cache the entire website manually.

Use browser-native immutable caching for versioned graphics assets:

- hashed or versioned geometry/model files
- textures
- environment maps if used
- scene configuration

Preload only the assets required for the first interactive viewport.

Deferred public sections and authenticated application code should not be added to the 3D boot dependency chain.

Where possible:

- preload the renderer chunk after initial HTML is available
- use browser cache for versioned scene assets
- avoid blocking font or non-critical below-fold assets
- reuse already cached assets between landing and authenticated dashboard visualizations when compatible

## Metric Hierarchy

Current metric text is too small in important places.

Desktop metric rules:

- primary numbers should be immediately readable at normal viewing distance
- labels remain secondary but never below practical readability
- trend text is tertiary
- exposure score and critical state receive stronger visual weight

Mobile metric rules:

- two-column cards maximum
- primary number size increases relative to the card
- labels and trends remain readable without zoom
- cards must never clip or overflow

Illustrative public telemetry must remain explicitly labeled as illustrative.

Authenticated dashboard metrics continue to use real workspace data only.

## Alignment and Collision Rules

The v4 layout must enforce geometry rather than relying on visual luck.

Rules:

- every major region has a fixed layout track or bounded container
- no page-level element may use arbitrary negative offsets to enter another region
- scene labels clamp to the scene box
- hero copy gets a maximum line measure
- metric cards use equal-height rows
- overview panel and runtime rail use explicit minimum widths and overflow handling
- all interactive controls stay inside their parent panel bounds
- no element may produce horizontal page overflow
- mobile safe-area insets are respected on Safari

## Component Boundaries

Recommended components:

- `LandingBootGate` - decides whether a cold-load boot screen is necessary
- `ScopeForgeBootScreen` - renders real progress and initialization states
- `CommandCenterLayoutDesktop` - desktop-only composition
- `CommandCenterLayoutMobile` - mobile-only composition
- `CommandCenterHeader` - functional public navigation
- `CommandCenterMetrics` - illustrative public metric band
- `AttackSurfaceOverview` - lower-left overview panel
- `AttackSurfaceScene` - Three.js renderer host
- `attack-surface/scene.ts` - Three.js scene construction
- `attack-surface/materials.ts` - material definitions
- `attack-surface/geometry.ts` - procedural attack-surface geometry
- `attack-surface/animation.ts` - motion and pulse controller
- `attack-surface/quality.ts` - adaptive quality selection
- `attack-surface/assets.ts` - versioned asset manifest and preload metadata
- `AttackSurfaceFallback` - DOM/SVG fallback

The Three.js rendering internals must remain isolated from navigation and page data.

## Data Flow

Public landing page:

1. HTML renders immediately with semantic hero text and fallback visual shell.
2. `LandingBootGate` checks whether the graphics payload is cold and whether reduced motion/WebGL constraints apply.
3. On cold load, boot screen tracks actual scene asset preparation.
4. Scene initializes using the selected quality tier.
5. Boot screen releases only after the first stable rendered frame or a bounded timeout fallback.
6. The page becomes interactive.

Authenticated dashboard:

- existing Supabase server queries remain unchanged
- real workspace values continue to come from the server
- graphics consume only normalized visual state and never gain database or network authority

## Failure Handling

The visual layer must fail open to a usable page.

If WebGL initialization fails:

- hide the canvas
- show the fallback surface
- continue rendering navigation, actions, metrics, and public content

If an optional 3D asset fails:

- degrade the relevant mesh/material
- do not block site entry indefinitely

The boot screen must have a maximum wait budget. On timeout it enters the site with a lower-quality or fallback visual rather than trapping the user.

The visual layer must not log secrets or Supabase credentials.

## Security Boundaries

This project remains a presentation-layer change.

It must not modify:

- Supabase schema
- RLS
- authentication authorization rules
- repository worker contracts
- runtime networking
- hosted runtime gates
- Phase 6D
- scanner authority
- Cloudflare/Turnstile behavior

The loader must never simulate a security control that is not actually running.

## Accessibility

- semantic heading order remains intact
- navigation is keyboard accessible
- mobile menu is keyboard and screen-reader accessible
- Three.js canvas is decorative unless a meaningful accessible summary is provided
- fallback content communicates the same high-level scene meaning
- `prefers-reduced-motion` is respected
- text contrast remains WCAG-readable
- no critical information exists only as color

## Testing and Acceptance

### Unit/component tests

Cover:

- cold vs warm boot decision
- WebGL fallback
- reduced-motion quality selection
- mobile vs desktop composition selection
- navigation destinations
- no placeholder Pricing/Company/Use Cases links
- illustrative telemetry labeling
- loader timeout fallback

### Layout regression tests

Verify at minimum:

- 1536 x 864 desktop reference
- 1440 x 900 desktop
- 1280 x 800 desktop
- 1024 x 768 tablet
- 430 x 932 modern iPhone
- 390 x 844 iPhone
- 360 x 800 small mobile

Assertions:

- no horizontal overflow
- no major element overlap
- all buttons remain inside containers
- scene labels remain inside scene bounds
- metric cards remain legible

### Performance acceptance

Target principles:

- HTML and hero text appear before 3D readiness
- cached repeat visits should not wait on a decorative loader
- mobile renderer maintains a smooth interaction budget by reducing quality rather than dropping frames aggressively
- page remains usable when WebGL is unavailable

### Full repository acceptance

Before merge:

- full Vitest suite
- TypeScript
- production Next.js build
- CLI build/version
- scanner benchmark
- npm audit
- exact-head diff/security-boundary review
- Vercel production deployment verification after merge
- custom-domain route verification
- runtime error check
- Supabase security advisor

GitHub Actions remain unused. All commits use `[skip ci]`.

## Non-goals

This design does not:

- implement Phase 6D
- change scanner behavior
- introduce fake live telemetry
- enable Turnstile
- add a fake Cloudflare check
- add product destinations that do not exist
- cache the entire application
- force every repeat visitor through a loader

## Recommended Implementation Order

1. layout and navigation correctness
2. desktop/mobile composition split
3. metric hierarchy and collision fixes
4. boot gate and cold-load progress system
5. Three.js scene foundation
6. materials and lighting
7. advanced animation and adaptive quality
8. mobile optimization
9. accessibility and fallback
10. visual regression and full acceptance

This order ensures the page is structurally correct before visual complexity is added.