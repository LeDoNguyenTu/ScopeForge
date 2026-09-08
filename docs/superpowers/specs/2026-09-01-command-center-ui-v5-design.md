# Command Center UI V5 Design

## Status

Approved design direction for replacing the visually rejected Command Center UI V4 implementation in PR #49.

The V4 implementation passed software/build acceptance but failed visual acceptance against the approved ScopeForge command-center reference. V5 treats that mismatch as a release blocker. PR #49 remains draft and must not merge until the V5 visual gates below pass.

## Goal

Rebuild the public ScopeForge command-center hero so the shipped experience is materially closer to the approved reference: a cohesive, premium security command center with a dense three-dimensional living attack-surface scene, strong depth and lighting, disciplined typography, integrated telemetry, and deliberately art-directed desktop and mobile compositions.

V5 is not a CSS-polish pass over V4. It replaces the current sparse raw-WebGL scene and removes the accumulated layout override strategy that allowed technically valid but visually weak output to pass acceptance.

## Non-goals

V5 does not change:

- Supabase schema, RLS, migrations, privileges, or data semantics.
- Authentication or authorization behavior.
- Runtime-network, worker, scanner, or Phase 6D authority boundaries.
- Hosted runtime capability gates.
- Finding persistence, verification, or evidence semantics.
- The authenticated product data model.
- Public illustrative telemetry into live/authoritative security facts.

## Reference fidelity

The approved command-center render is the visual north star. V5 should reproduce its design language and composition closely without turning the page into a static screenshot.

The implementation must preserve these characteristics:

- a dark near-black environment with restrained teal/cyan illumination and risk-orange accents;
- a large radial central forge/aperture core with multiple layered rings/platforms;
- six or more visually distinct infrastructure arms/nodes with meaningful vertical structure;
- translucent and wireframe architectural forms rather than flat line diagrams;
- strong depth ordering, occlusion, perspective, glow, and illuminated network paths;
- a scene that feels volumetric at first glance rather than like a 2D graph;
- integrated status labels that visually belong to the scene;
- compact telemetry and risk information that reads as one command-center composition rather than unrelated dashboard cards;
- precise spacing, baseline alignment, and hierarchy in headline, supporting copy, controls, metrics, and overview content.

The scene does not need pixel-identical geometry to the reference. It does need comparable perceived density, polish, depth, and visual hierarchy.

## Architecture decision: Three.js V5 renderer

Three.js is an explicitly approved runtime dependency for V5.

The old raw-WebGL renderer is replaced by a focused Three.js scene package. Three.js is used because V5 needs real scene-graph composition, meshes, materials, depth, lighting, and adaptive rendering quality. Reimplementing that stack directly in raw WebGL would increase complexity while keeping a lower visual ceiling.

The renderer remains presentation-only. It receives a frozen, serializable visual model and owns no Supabase client, credentials, security authority, scanner authority, runtime-worker authority, or canonical evidence.

### Scene units

The Three.js implementation should be split into focused units rather than one large renderer file:

- `scene/model`: serializable display model and stable entity identities;
- `scene/geometry`: aperture core, radial platforms, arms, towers, panels, and connector paths;
- `scene/materials`: healthy, neutral, pending, and risk materials plus glow variants;
- `scene/lighting`: scene lights, fog/atmosphere, exposure configuration;
- `scene/effects`: bloom/post-processing when the active quality tier allows it;
- `scene/animation`: hub rotation, pulses, path illumination, idle drift, and pointer parallax;
- `scene/quality`: capability detection, runtime performance sampling, and quality transitions;
- `scene/controller`: lifecycle, resize, visibility, pause/resume, first-stable-frame, and disposal.

No scene unit may import backend/data-authority modules.

## Scene composition

### Central forge core

The core is the strongest visual anchor and should occupy the visual center of the network. It contains:

- a dark solid base platform;
- two or more counter-rotating aperture/radar rings;
- an emissive inner energy source;
- layered radial rails/spokes;
- subtle vertical depth so the core reads as an object, not concentric SVG circles;
- teal/cyan illumination with a small warm risk pulse where appropriate.

### Infrastructure arms

Each scene arm is built from actual geometry:

- a platform/bridge leaving the core;
- at least one elevated structural node/tower near the endpoint;
- line/wireframe detail over darker solid or translucent surfaces;
- health/risk illumination derived from the visual model;
- a stable anchor for the corresponding DOM label.

The default illustrative landing scene may use labels such as Web Application, Sandbox, Third Party, Data Store, Identity, and Cloud, but they remain clearly illustrative. Authenticated dashboard variants must continue to derive labels/states from real workspace data.

### Paths and pulses

Connector paths are not just static thin lines. Selected paths use:

- a dim structural path;
- a brighter moving pulse/tracer;
- localized glow around active/risk segments;
- warm orange/red emphasis for risk paths;
- teal/cyan emphasis for healthy or verified paths.

Animation must remain subtle enough that text remains readable.

## Materials and rendering

V5 uses antialiased WebGL on supported devices. Mobile must not automatically mean `antialias: false`.

Preferred material strategy:

- dark physically shaded or standard materials for structural mass;
- transparent/low-opacity panels only where they materially improve depth;
- emissive accents for active/risk states;
- additive glow duplicates or selective bloom for high/balanced tiers;
- restrained fog/atmospheric depth rather than heavy blur;
- limited transparent overdraw to keep mobile performance predictable.

Expensive post-processing is quality-tier dependent. It must never be required for semantic correctness or basic legibility.

## Adaptive quality

Quality is capability/performance driven, not user-agent driven.

The renderer starts from a conservative but visually acceptable tier and may move up or down after a short warm-up sample. Inputs may include:

- viewport size;
- device pixel ratio;
- `navigator.hardwareConcurrency` when available;
- device memory when exposed;
- reduced-motion preference;
- measured render-frame timing during initialization.

### Quality targets

`ultra/high`:

- DPR cap up to 2.25, subject to measured frame time;
- full geometry density;
- antialiasing enabled;
- bloom/post-processing enabled;
- full pulse/particle density;
- translucent architectural panels enabled.

`balanced`:

- DPR cap approximately 1.75-2.0;
- antialiasing enabled;
- moderately reduced secondary geometry/particles;
- restrained bloom or glow;
- transparent panels retained where inexpensive.

`mobile-balanced`:

- DPR cap approximately 1.75 on capable modern devices;
- antialiasing enabled;
- preserve core/tower geometry and depth;
- reduce particle count and expensive effects before reducing structural quality;
- use simpler glow if bloom is too expensive.

`low/reduced`:

- lower DPR and effect density;
- no continuous animation for reduced-motion;
- retain clean solid/wireframe geometry and a visually coherent static frame.

A quality downgrade must first remove expensive effects/particles. It must not immediately collapse the scene into the sparse V4 wireframe appearance.

## Progressive first-frame experience

The user must never stare at a crude half-initialized scene.

V5 uses a high-quality static poster/fallback derived from the V5 scene itself. The poster is displayed immediately while the Three.js module, geometry, materials, and first stable frame initialize.

Requirements:

- poster uses the same composition/camera as the live scene;
- poster is stored in an efficient modern image format with an appropriate responsive size;
- live canvas renders behind/over the poster and crossfades only after a stable first frame;
- the existing boot/progress experience may report genuine renderer milestones;
- timeout/failure keeps the polished poster visible rather than falling back to the old sparse line drawing;
- poster and live scene must not cause layout shift.

The poster is presentation-only and may contain only illustrative public data on the public landing page.

## Desktop composition

Desktop is designed independently around a wide command-center canvas.

### First viewport

The first viewport should read as one intentional composition:

- floating navigation dock across the top;
- editorial headline/supporting copy in the left third;
- large Three.js scene dominating the center/right two-thirds;
- four compact illustrative telemetry cards integrated below the copy rather than visually detached;
- attack-surface overview aligned below the metrics;
- runtime/scene-status strip integrated near the lower edge of the scene;
- labels positioned from stable scene anchors so they remain visually attached to entities.

Desktop should target 1280-1728 px widths explicitly and remain coherent at common laptop widths. Components must not rely on arbitrary accumulated `top/left` overrides from older V3/V4 stylesheets.

## Mobile composition

Mobile is a separate art-directed composition, not desktop reordered by CSS alone.

Order and hierarchy:

1. compact mobile header;
2. eyebrow, headline, supporting copy, and primary/secondary actions;
3. immersive scene as the dominant visual object;
4. compact telemetry integrated with or immediately following the scene;
5. runtime/scene status;
6. attack-surface overview/risk summary;
7. subsequent product narrative sections.

The mobile scene should use most of the available viewport width and enough height to preserve depth. Telemetry must not push the main visual several screens below the headline.

Mobile-specific camera, label positions, geometry scale, and text wrapping are allowed and expected. Shared components may use common data/models, but desktop coordinates must not leak into the mobile composition.

Primary mobile acceptance targets include modern iPhone Safari at approximately 390-430 CSS px widths, plus a smaller 360 px class.

## Typography and layout system

V5 replaces ad-hoc overrides with a small explicit design system for the command-center surface:

- one container/grid definition per breakpoint family;
- a documented spacing scale;
- a defined headline/body/label/metric type scale;
- tabular numerals for metrics;
- consistent card radius/border/padding rules;
- deliberate max-widths and line lengths;
- explicit mobile line breaks only where composition benefits;
- no text positioned with arbitrary offsets relative to unrelated elements.

Visual alignment is evaluated from screenshots, not inferred from DOM structure alone.

## Public telemetry honesty

Public landing metrics and topology labels remain illustrative unless backed by real public product data. They must be labeled as illustrative and must not imply that ScopeForge is currently monitoring a real customer environment.

Authenticated surfaces continue to use real workspace data and must not invent attack paths, exploitability, or exposure scores from absent evidence.

## Accessibility

- Three.js canvas is decorative/`aria-hidden`.
- Equivalent labels/state remain in DOM content.
- Controls are keyboard accessible.
- Text contrast remains WCAG-appropriate against the dark surface.
- `prefers-reduced-motion` renders a high-quality static state and disables continuous movement.
- Scene pause/resume remains available when continuous animation is active.
- No information is conveyed by color alone.

## Performance budget

Visual quality is the priority, but the page must remain usable on mobile Safari.

Targets after the loading/poster strategy is in place:

- no blocking model/texture downloads are required for the hero;
- Three.js may be dynamically imported;
- geometry is generated locally from bounded primitives;
- no unbounded particle systems;
- continuous animation pauses when offscreen or when the document is hidden;
- renderer disposes geometry/materials/render targets/listeners on unmount;
- measured quality adaptation should aim for a stable interactive frame rate, reducing post-processing and particles before core geometry quality;
- no visible layout shift when poster transitions to live canvas.

## Dependency policy

`three` is the only new runtime dependency approved by this design unless a separate review establishes that another dependency is necessary.

Three.js examples modules (such as EffectComposer/UnrealBloomPass) may be imported from the installed `three` package; they do not justify adding another runtime package.

No remote 3D models, texture CDNs, tracking libraries, or analytics packages are required for the scene.

## CSS migration strategy

V5 should not accumulate another override stylesheet on top of V4.

The implementation should:

- introduce a dedicated V5 stylesheet/module or tightly scoped V5 styles;
- remove V4-specific layout rules once V5 markup replaces them;
- delete obsolete V3/V4 scene/layout CSS that no longer has consumers;
- keep unrelated authenticated/product styles untouched;
- avoid global selectors that can affect other pages.

The final PR diff should make it obvious which style system owns the command-center page.

## Testing strategy

### Unit/structural tests

Tests continue to cover:

- semantic content and CTA destinations;
- public illustrative telemetry labeling;
- scene-model validation and stable entity identities;
- quality selection and downgrade/upgrade decisions;
- reduced-motion behavior;
- visibility/offscreen pause behavior;
- renderer resource disposal;
- poster-to-canvas state transition;
- desktop/mobile composition component boundaries;
- no backend/security-authority imports from renderer modules.

### Visual acceptance

A green unit-test suite is necessary but no longer sufficient.

Before PR #49 may leave draft state, V5 requires fresh visual evidence from the exact candidate SHA.

Capture and review at minimum:

- desktop wide viewport around 1440x900;
- desktop laptop viewport around 1280x800;
- mobile iPhone-class viewport around 390x844;
- mobile large iPhone-class viewport around 430x932;
- reduced-motion/static state.

The screenshots are compared against the approved reference for:

- composition and hierarchy;
- typography alignment;
- scene density and depth;
- antialiasing/perceived sharpness;
- label attachment/alignment;
- metric/card alignment;
- absence of clipping/overflow/overlap;
- poster/live-scene continuity.

Visual acceptance must be an explicit human/reviewer gate. The PR must not claim the design is accepted solely because DOM, typecheck, build, or renderer tests pass.

Where practical, add automated screenshot regression coverage with stable deterministic scene time/camera, but human visual review remains required for this redesign.

## Acceptance criteria

V5 is ready for merge only when all of the following are true:

- the user-approved desktop reference is recognizably reflected in the shipped composition;
- the scene no longer resembles the sparse V4 wireframe prototype;
- desktop and mobile are independently composed and reviewed;
- modern iPhone Safari receives an antialiased, sharp scene unless measured performance requires downgrade;
- visual labels/text/cards are consistently aligned with no obvious overlaps or floating outside intended regions;
- the first visible frame is polished even before Three.js initialization completes;
- public telemetry remains explicitly illustrative;
- accessibility and reduced-motion paths work;
- focused tests, full tests, typecheck, audit, and production build pass on the final candidate as required by the release workflow;
- a Vercel preview of the exact visual candidate is READY and manually reviewed on both desktop and mobile;
- PR #49 remains draft until the visual review passes;
- no Phase 6D/runtime/security behavior is changed by the UI redesign.

## Relationship to Phase 6D

V5 UI work is temporarily prioritized ahead of remaining Phase 6D Task 15/16 execution at the user's request. It must not modify Phase 6D implementation or production capability gates.

After the V5 visual candidate is accepted and PR #49 is in a genuinely merge-ready state, work can return to the previously paused real-Linux Task 15 acceptance and Task 16 release review.
