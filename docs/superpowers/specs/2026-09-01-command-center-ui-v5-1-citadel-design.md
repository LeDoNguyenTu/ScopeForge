# Command Center UI V5.1 Citadel Design

## Status
Approved for implementation on the isolated preview branch before PR #49 changes.

## Objective
Rebuild the public landing hero so it reads as a premium, product-grade security platform rather than a simplified demo. Desktop visual quality is the primary target. Mobile remains first-class and readable, but the desktop scene may use substantially higher geometry and effects budgets.

## Visual target
The supplied ScopeForge reference image is the visual composition target: a dark graphite interface, a dense radial security citadel, teal/cyan healthy paths, orange/amber risk paths, restrained glass telemetry, and strong depth without neon-overload.

This is an original ScopeForge implementation. Do not copy ThreeUI source or assets. ThreeUI is used only as a quality bar for density, motion, polish, sharpness, and responsive composition.

## Palette
Use these values as the primary color language:
- Background black: `#05070A`
- Secondary black: `#0A0C10`
- Structural slate: `#171C21`, `#252D34`, `#313B43`
- Primary teal: `#5CE2C9`
- Electric cyan: `#38E4DE`
- Risk orange: `#FF6A38`
- Warm amber: `#F8B45B`
- Main text: `#EEF6F4`
- Muted text: `#809298`

No unrelated accent colors.

## Architecture
Keep Three.js as the only runtime rendering dependency. Build a procedural scene with a small amount of authored, model-like geometry encoded directly in focused TypeScript modules. Use instancing for repeated structural details. Preserve the existing presentation-only renderer boundary: no Supabase, scanner, runtime-worker, or security-authority imports inside the visual renderer.

### Scene layers
1. **Citadel core** - stacked mechanical decks, concentric rings, inner energy chamber, upper crown, radial braces, underside mass, transparent wireframe shells.
2. **Six armatures** - segmented bridges with trusses, rails, secondary ribs, under-deck supports, glow conduits, moving packets.
3. **Endpoint compounds** - each endpoint becomes a small compound with multiple towers/platforms/cages/antennae instead of one box.
4. **Holographic detail** - translucent panels, scan planes, wire cages, node markers, orbit arcs.
5. **Atmosphere** - particles, dust/pollen-like motes, sparse sparks, depth haze, restrained bloom.
6. **Attack path** - a physically routed teal/orange path through the scene with cascading illumination and distinct critical-risk emphasis.

## Geometry density requirements
For balanced quality and above:
- At least 8 visible concentric/core ring elements.
- At least 3 mechanical core decks plus one raised crown.
- Six structural arms.
- Each arm contains at least 3 bridge segments and 2 secondary structural supports.
- Each endpoint compound contains at least 4 distinct visible meshes in addition to its base.
- Total scene mesh count must exceed 90 at balanced quality before instanced sub-elements are counted.
- At least 2 risk endpoints use orange/amber structural emphasis.
- At least 3 distinct vertical height levels are visible across the scene.

Constrained/reduced quality may remove secondary details but must retain the same overall silhouette and all six compounds.

## Motion system
The live scene must have at least six independent motion channels:
1. Counter-rotating core rings.
2. Energy-core breathing/pulsing.
3. Travelling packets along all six arm paths.
4. Cascading risk-path illumination.
5. Endpoint scan/hologram motion.
6. Ambient particle drift.
7. Optional camera inertia/parallax and subtle scene float are additive, not substitutes.

Motion must feel layered and continuous, not like every object moves at the same speed. Reduced-motion mode disables looping translation/rotation and shows a polished static frame.

## Rendering quality
Prioritize visual sharpness before cutting resolution.

### Cinematic desktop
- DPR cap: 2.5.
- Antialiasing on.
- Bloom on.
- Full structural detail.
- Highest particle/detail factor.

### Balanced
- DPR cap: 2.0.
- Antialiasing on.
- Bloom on at reduced strength.
- Full primary geometry and most secondary detail.

### Constrained
- DPR cap: 1.5.
- Bloom off.
- Reduce particles and micro-structure first.
- Keep silhouette, compounds, routed attack path, and readable labels.

### Reduced motion
- DPR cap: 1.5.
- No continuous looped motion.
- No bloom requirement.
- Keep high-quality static scene.

Modern high-DPR phones with sufficient memory should select balanced quality rather than being downgraded solely because of viewport width.

## Camera and composition
### Desktop
- Desktop is the primary art-directed composition.
- Scene occupies the dominant right side and visually overlaps the telemetry zone without covering text.
- Camera is lower and more cinematic than V5, with stronger perspective and visible underside/depth.
- The complete radial silhouette must remain readable at 1440x900 and 1280x800.

### Mobile
- Use a separate mobile camera and composition.
- Scene remains centered and sharp, with endpoint labels kept inside the safe viewport.
- No tiny desktop labels scaled down blindly.

## UI scale requirements
The previous V5 micro-dashboard typography is rejected.

### Desktop minimum visual scale
- Metric values: `32px` minimum, target `34-38px`.
- Metric labels: `13px` minimum.
- Metric icons: `24px` minimum.
- Overview primary score: `30px` minimum.
- Runtime labels/values: `12px` minimum.
- Hero body: `16px` minimum.

### Mobile minimum visual scale
- Metric values: `34px` minimum, target `36-42px`.
- Metric labels: `14px` minimum.
- Supporting metric copy: `12px` minimum.
- Metric icons: `24px` minimum, target `26-28px`.
- Overview labels: `13px` minimum.
- Risk path copy: `12px` minimum.
- Runtime values: `13px` minimum.

Avoid cramped two-column cards if these minimums cannot fit; increase card height before shrinking typography.

## Loading and fallback
Keep poster-first loading and the boot gate. The current V5 poster may remain during the first V5.1 preview only, but final acceptance requires a poster regenerated from the accepted Citadel scene so the handoff does not visibly jump between different compositions.

## Performance
- Pause rendering when the document is hidden or scene is outside the viewport.
- Preserve explicit pause/resume control.
- Reuse geometries/materials where practical.
- Prefer `InstancedMesh` for repeated braces, deck modules, endpoint microstructures, and particles.
- Do not add another runtime 3D library.

## Security and scope boundary
Presentation-only change. Do not modify Phase 6D controls, runtime networking, worker authority, scanner behavior, Supabase schema/RLS/auth, Turnstile, or hosted runtime gates.

## Acceptance gates
The preview is not acceptable merely because it builds.

Required visual checks:
- 1440x900 desktop.
- 1280x800 desktop.
- 430x932 mobile.
- 390x844 mobile.
- reduced-motion/static mode.

Pass criteria:
- Scene reads as a dense industrial/cybersecurity citadel, not six simple boxes around a ring.
- No label, card, or heading clipping.
- Typography and icons meet minimums above.
- Teal/orange palette matches the supplied reference.
- Scene remains sharp on desktop and modern phones.
- Motion visibly includes multiple independent channels.
- No material frame hitch during ordinary idle animation on capable desktop hardware.
- PR #49 remains draft until user approves the V5.1 preview.
