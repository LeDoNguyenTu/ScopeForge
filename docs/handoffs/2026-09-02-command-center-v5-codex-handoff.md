# ScopeForge Command Center V5 - Codex Continuation Handoff

Date: 2026-09-02

This file is the authoritative handoff for continuing the Command Center V5 landing-page reconstruction in Codex.

## 1. Repository and active state

- Repository: `LeDoNguyenTu/ScopeForge`
- Active implementation branch: `preview/command-center-v5-reference-rebuild`
- Last verified implementation commit before this documentation commit: `227654d7d9057fd56751f6d72d4b97eafb476e7e`
- Commit message: `feat: instance v5 repeated micro hardware [skip ci]`
- Verified Vercel deployment: `https://scopeforge-qov62825f-itsbrian.vercel.app`
- Vercel deployment ID: `dpl_81EXvuEaTDVbJdqUJmnYrDcGMtHy`
- Deployment state for `227654d7...`: `READY`
- Focused V5 verification at that SHA: 6 Vitest files, 29 tests, all passed
- Next.js 15.5.24 production build at that SHA: passed

PR #49 is still the release PR context:

- PR: `#49 - Command center UI v4 [skip ci]`
- State: open
- Draft: true
- Merged: false
- Base: `main`
- Current PR head is still the older `feat/command-center-ui-v4` branch, not the V5 reconstruction branch.
- DO NOT merge PR #49, mark it ready, retarget it, or otherwise promote V5 until the user explicitly approves the final visual result.

GitHub Actions must remain unused for this work. Commits must continue to include `[skip ci]` and must not add AI co-author attribution.

## 2. Governing objective

Rebuild the public ScopeForge landing page so the hero is genuinely close to the approved visual references, especially the clean graph-only reference image, while remaining a real live Three.js scene.

This is not a generic radial network diagram. The target is a premium cybernetic/mechanical attack-surface platform with:

- a dense circular mechanical central citadel
- six simultaneously visible articulated arms
- dark metallic faceted plating and mechanical subdivision
- low-profile holographic/wireframe endpoint architecture
- teal healthy routes
- orange risk routes owned only by `WEB APPLICATION` and `DATA STORE`
- a shielded orange reactor/star at the center
- readable labels anchored to the actual projected 3D endpoint positions
- restrained bloom and emissive lighting rather than large washed-out glow
- elevated three-quarter framing that keeps the complete topology visible
- separate mobile composition/camera rather than a scaled desktop scene

The graph-only proof gate remains mandatory. Do not spend significant effort on the rest of the landing page until the live graph materially converges with the supplied reference images.

## 3. Absolute visual-integrity rule

Do not use the reference artwork as the live hero.

Forbidden:

- reference image as webpage hero background
- static screenshot plus CSS/particle overlays pretending to be Three.js
- screenshot or generated image as the scene itself
- cropping the supplied reference into the hero
- embedding a generated master render as the main visual
- any 2D-image-base approach presented as a live reconstruction

A poster image is allowed only during initial loading and as a capability/reduced fallback. Once WebGL is ready, the visible hero must be actual Three.js geometry.

There is an important wrong-path commit in history that must NOT be restored wholesale:

- `4b9af5b6f077253510c87ad8924c06d3d6907ae6`
- message: `feat: use approved master attack surface with live transition shader [skip ci]`

That experiment used a static master image as the structural base. It produced a READY Vercel deployment but violates the current governing implementation rules. Do not cherry-pick or resurrect its image-base hero. Selective non-image layout ideas may be inspected only if useful.

Its parent test experiment is also not authoritative:

- `2de173418c702febba245ba08de4d118329a72d0`
- message: `test: lock v5.3 approved master hero contracts [skip ci]`

Some tests there explicitly required the static master image and therefore conflict with the current spec.

## 4. Current live Three.js architecture

Primary files:

- `components/landing/AttackSurfaceSceneV5.tsx`
- `components/landing/attack-surface-v5/model.ts`
- `components/landing/attack-surface-v5/quality.ts`
- `components/landing/attack-surface-v5/materials.ts`
- `components/landing/attack-surface-v5/geometry.ts`
- `components/landing/attack-surface-v5/citadel-core.ts`
- `components/landing/attack-surface-v5/citadel-arm.ts`
- `components/landing/attack-surface-v5/citadel-compound.ts`
- `components/landing/attack-surface-v5/atmosphere.ts`
- `components/landing/attack-surface-v5/controller.ts`
- `components/landing/attack-surface-v5/animation.ts`
- `components/landing/attack-surface-v5/lighting.ts`
- `components/landing/attack-surface-v5/effects.ts`

Current focused tests:

- `tests/components/attack-surface-v5-quality.test.ts`
- `tests/components/attack-surface-v5-geometry.test.ts`
- `tests/components/attack-surface-v5-animation.test.ts`
- `tests/components/attack-surface-v5-controller.test.ts`
- `tests/components/attack-surface-v5-reference-contract.test.ts`
- `tests/landing/command-center-v5-1-scale-contract.test.ts`

Current package scripts intentionally use a focused preview acceptance build:

```json
"prebuild": "NODE_ENV=test npx vitest run tests/components/attack-surface-v5-quality.test.ts tests/components/attack-surface-v5-geometry.test.ts tests/components/attack-surface-v5-animation.test.ts tests/components/attack-surface-v5-controller.test.ts tests/components/attack-surface-v5-reference-contract.test.ts tests/landing/command-center-v5-1-scale-contract.test.ts",
"build": "NEXT_PUBLIC_SUPABASE_URL=https://acceptance.invalid NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_scopeforge_visual_review NODE_ENV=production next build"
```

Do not mistake these focused preview checks for final full-repository release verification. Before final promotion, restore/validate the intended normal build path and run the complete relevant repository acceptance suite.

## 5. Work completed on this reconstruction branch

### Reference contract and topology

The model currently owns six entities:

1. `WEB APPLICATION` - risk - `2 Findings`
2. `SANDBOX` - healthy - `Isolated`
3. `THIRD PARTY` - healthy - `Monitored`
4. `DATA STORE` - risk - `At Risk`
5. `IDENTITY` - healthy - `Healthy`
6. `CLOUD` - healthy - `Verified`

Only `WEB APPLICATION` and `DATA STORE` are risk branches. Tests assert their route state and label-anchor state.

### Central citadel

The old visible torus-stack problem has been reduced. The current core includes:

- five stepped mechanical deck levels
- segmented mechanical armor shell
- radial plates
- cavities
- segmented rim pieces
- inner walls
- understructure/cage
- central energy chamber/lattice
- shielded orange reactor/star
- reactor spokes and nodes
- only eight visible core torus rings in the latest architecture
- additional segmented energy bands rather than relying on a dominant torus stack

The reference test now rejects a dominant torus-stack implementation.

### Six arms

The earlier five-obvious-BoxGeometry bridge structure was explicitly locked as a failing regression and then replaced.

Current arms use:

- custom faceted bridge-deck geometry
- articulated segments
- layered armor plates
- cavities
- side rails
- diagonal braces
- under-supports
- joints/hinges
- node lights
- embedded route tubes and route aura
- asynchronous moving route packets
- one real nano-transition structural material region on the web-app branch

The reference contract rejects `BoxGeometry` as the primary named bridge segment geometry.

### Endpoint architecture

The earlier explicit tall `v5-tower-*` endpoint mesh was removed because it violated the requested low-profile reference silhouette.

Current endpoints contain:

- low-profile mechanical bases
- perimeter illumination
- supporting pylons/satellites
- scan planes
- holographic/wireframe cage frames
- holographic nodes
- holographic core/energy
- projected DOM label anchors attached to actual scene objects

The reference contract explicitly asserts there are no `v5-tower-*` meshes and that endpoint bounds remain low profile.

### Nano-tech transition shader

`materials.ts` contains a real `THREE.ShaderMaterial` with:

- carbon micro-weave stage
- Voronoi/cellular transition breakup
- hex-grid transition detail
- teal emissive transition edge
- resolved metallic stage
- vertex displacement in the transition band

This is actual material/shader behavior, not an image overlay.

### Animation

Independent motion channels include:

- ring rotation
- core breathing
- path packets
- risk cascade/pulsing
- endpoint scan/hologram movement
- atmospheric drift

Long-session holographic float is bounded and idempotent at a fixed timestamp.

A live framing bug was found and fixed in `3f2bc0515f9fd2b2a922ce88acce28526405026c`: animation previously overwrote the controller's `surfaceY` framing offset on the first frame. Animation now records `v5BaseSurfaceY` and floats around the controller-provided composition instead of resetting toward zero.

### Performance

At `227654d7...`, repeated micro-hardware was moved to a shared `THREE.InstancedMesh` with 108 instances across the core and six arms. The geometry descriptor was also corrected to reflect the current eight-ring, zero-tower architecture.

Current quality tiers are:

- cinematic DPR cap 2.5
- balanced DPR cap 2.0
- constrained DPR cap 1.5
- reduced-motion DPR cap 1.5

The scene already includes visibility/intersection pausing, document-visibility pausing, reduced-motion handling, adaptive quality selection, and controller disposal.

## 6. TDD history from the latest continuation

The latest work deliberately followed RED -> GREEN.

New failing contracts were added for:

- no five obvious box bridge blocks
- no dominant torus stack
- no tall endpoint tower
- preservation of controller framing offset during animation
- truthful current geometry counts
- use of instanced repeated micro-hardware

Observed RED failures were exactly those expected, while previous contracts stayed green. They were then implemented and verified.

Final verified state before this documentation commit:

- 6 focused test files passed
- 29 tests passed
- production Next.js build passed
- Vercel deployment READY

## 7. Visual-capture blocker and what was already tried

The biggest unresolved gate is not code execution. It is trustworthy automated visual inspection of the protected Vercel preview from the previous ChatGPT environment.

A disposable diagnostic branch exists:

- `diag/v5-reference-live-capture`

Notable diagnostic commits:

- `d3e60411073426ecf6f279f941eb3992a5e25e1b` - initial visual proof proxy
- `211ba7ee0544c35e170c97a0242e95d0f4dc74bc` - PNG pixel diagnostic
- `b08ba24327657c4be8edacb100e2a3d9363dbe63` - authenticated target support
- `28cd34f82b53d8d054958af758d0da73e7da2814` - Microlink browser-capture diagnostic

Webstractor and Microlink both captured Vercel's protection/interstitial page instead of the actual protected WebGL preview, even when temporary Vercel share URLs were attempted. Their returned captures were nearly all white, which was correctly treated as an infrastructure/protection result, not as the ScopeForge page.

A local Chromium/SwiftShader route in that ChatGPT container was also not trustworthy enough to use as acceptance evidence.

Do not continue spending time on the disposable screenshot API route unless it becomes useful. Codex running in the local repository should prefer a local browser acceptance harness against `localhost`, where Vercel protection is irrelevant.

## 8. Immediate Codex priority - graph-only visual proof

Codex should start from the current branch and use a real local browser, preferably Playwright or an existing browser automation facility available in the Codex environment.

Suggested initial sequence:

```bash
git fetch origin
git checkout preview/command-center-v5-reference-rebuild
git pull --ff-only

git status
git log -8 --oneline

npm install
npm run typecheck
npm run test -- tests/components/attack-surface-v5-quality.test.ts tests/components/attack-surface-v5-geometry.test.ts tests/components/attack-surface-v5-animation.test.ts tests/components/attack-surface-v5-controller.test.ts tests/components/attack-surface-v5-reference-contract.test.ts tests/landing/command-center-v5-1-scale-contract.test.ts
npm run dev
```

Then capture the actual local page at **1920x1080** after WebGL is stable.

Before comparing pixels, verify that the canvas state reports live WebGL rather than poster/fallback.

Compare side by side with both supplied user reference images, with the clean graph-only image as the PRIMARY geometry/composition target.

Do not proceed to broader landing-page work if the graph still reads as:

- simplified radial diagram
- repeated primitive bridge blocks
- tower endpoints
- obvious torus stack
- generic Three.js demo
- infographic rather than a mechanical platform
- excessive glow obscuring physical mass
- cropped endpoints or unreadable topology

## 9. Graph visual acceptance checklist

The 1920x1080 gate should show all of the following simultaneously:

- complete six-arm topology
- elevated three-quarter camera
- no cropped endpoint
- no giant foreground object covering the hub
- dense mechanical circular platform
- thick articulated arms with multi-scale detail
- faceted/subdivided plating
- dark mechanical mass dominating over glow
- low-profile holographic endpoint architecture
- teal healthy paths
- orange WEB APPLICATION path
- orange DATA STORE path
- orange shielded central reactor/star
- labels visibly connected to their actual 3D endpoints
- no label over the hub
- no giant white bloom rings
- visible real nano-tech transition on a selected structural region
- crisp high-resolution rendering

Iterate geometry, materials, lighting and camera based on screenshots until materially converged with the supplied references. Automated tests do not replace this gate.

## 10. Only after graph-only visual acceptance

Then continue landing-page V5 cleanup.

Required desktop header:

```css
grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
```

- brand left
- Product / Security model / GitHub centered
- auth actions right

Runtime bar must be exactly four equal cells:

```css
grid-template-columns: repeat(4, minmax(0, 1fr));
```

Cells:

1. Scene / Running
2. Sensors / 182
3. Coverage / 98%
4. Pause animation

No empty spacer cell.

Desktop hero typography target:

- eyebrow: 13-14 px
- H1: roughly 58-78 px via clamp
- body: 16-18 px
- CTA: 15-16 px

Metric cards:

- values: 32-36 px
- icons: 24-28 px
- labels: 14-15 px
- supporting text: 12.5-13.5 px
- tabular numerals where appropriate

Attack Surface Overview:

- supporting labels at least 12-13 px
- main text 14-15 px
- risk text 13-14 px
- score around 30 px

Workflow:

- eyebrow >= 14 px
- step label 15 px
- icons 26-28 px
- headings 23-25 px
- body 15.5-17 px
- desktop preferably 4 + 3 cards, not seven tiny slivers

Security model:

- eyebrow >= 14 px
- heading roughly 48-60 px
- body 16-17 px
- card title 18-20 px
- card body 15-16 px
- icons >= 26 px

## 11. Responsive acceptance

Required screenshot sizes after the graph gate and final UI work:

- 1920x1080 - primary graph gate
- 1728x1117
- 1440x900
- 1280x800
- 430x932
- 393x852

Responsive intent:

- desktop >= 1200: highest-quality composition/detail
- tablet 900-1199: moderately reduced detail while preserving silhouette
- mobile < 900: separate camera/composition, not a scaled desktop scene

On modern phones, reduce particles, secondary geometry, expensive transparency/post effects and similar effects before reducing core geometry clarity.

Reduced motion must still show a beautiful real static Three.js scene. Disable repetitive movement without degrading into an ugly fallback.

## 12. Final engineering/release verification

Before asking the user for final approval:

1. Run focused V5 tests.
2. Run full repository tests, not only the focused preview prebuild suite.
3. Run `npm run typecheck`.
4. Run the normal production build with the intended release build configuration.
5. Run relevant CLI/build checks if the final branch touches shared configuration.
6. Run `npm audit --audit-level=info` if dependency/configuration changes occurred.
7. Capture every mandatory desktop/mobile visual size.
8. Verify live WebGL, poster transition, fallback, reduced motion and cleanup/disposal.
9. Publish a Vercel preview.
10. Record exact SHA and exact preview URL.
11. Keep PR #49 draft and unmerged.
12. Present screenshots/results to the user and wait for explicit visual approval.

Only after explicit approval should PR integration/merge be considered.

## 13. Hard scope boundaries

This work is presentation-layer only.

Do not modify:

- Supabase schema
- RLS
- authentication behavior
- scanner authorization
- Phase 6D containment/network workers
- hosted worker/runtime security boundaries
- Turnstile/security gates
- unrelated API security

Three.js is the only newly approved runtime visualization dependency. Do not add another 3D/visualization framework unless the user explicitly approves it.

## 14. Commit discipline

Continue small TDD commits.

Examples:

```bash
git commit -m "test: lock v5 <specific invariant> [skip ci]"
git commit -m "feat: refine v5 <specific visual component> [skip ci]"
git commit -m "fix: correct v5 <specific regression> [skip ci]"
```

Do not add AI co-author trailers or attribution.

## 15. Decision rule for Codex

Normal engineering decisions are delegated to Codex. Do not stop to ask the user for routine implementation choices.

Stop and ask only when:

- an action is destructive or irreversible
- credentials/account login are required and unavailable
- the requested change would cross the security/backend scope boundary
- final visual approval is required before merging/promoting PR #49

The next meaningful task is **real graph-only browser visual acceptance and screenshot-driven iteration**, not more speculative CSS or unrelated landing-page work.
