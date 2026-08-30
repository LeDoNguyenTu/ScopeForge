# Living Attack Surface WebGL V2 Design

## Goal

Bring the authenticated ScopeForge dashboard much closer to the approved Living Attack Surface concept: an immersive first viewport, large editorial copy, real workspace metrics, and an animated security topology that feels like an interactive command center rather than a conventional SaaS dashboard.

## Product principles

- Real workspace data only. Do not present invented telemetry, sensors, risk paths, or exposure scores as live facts.
- Security authority does not change. This phase is presentation only.
- The WebGL renderer is decorative and exploratory, never authoritative. Findings, verification state, and actions still come from trusted server queries.
- The dashboard remains usable if WebGL is unavailable, reduced motion is requested, or the device is resource constrained.
- Mobile Safari is a first-class target.

## Dashboard composition

The dashboard home uses an immersive shell rather than the standard left-sidebar shell. Other authenticated pages keep the existing sidebar.

The first viewport contains:

1. A floating top navigation dock with the Forge Aperture wordmark, Overview, Assets, Findings, workspace identity, and sign-out access.
2. A left editorial column with the eyebrow `LIVING ATTACK SURFACE`, the headline `Understand the risk before it becomes an incident.`, supporting copy, primary action, and secondary action.
3. A right and center WebGL attack-surface scene with a Forge Aperture core, radial infrastructure arms, wireframe nodes, animated pulses, healthy/pending/risk states, and DOM labels derived from real assets.
4. Four compact real-data metrics: registered assets, verified assets, open findings, and verification coverage.
5. A lower overlay panel showing the highest-priority real asset/finding summary and a small scene-status strip. Do not call the scene `monitoring` unless runtime monitoring is actually active.

## Real-data model

The server dashboard query selects assets with `id`, `kind`, `name`, `canonical_target`, `verification_status`, and `created_at`. It also selects active findings with `asset_id`, `severity`, `title`, and `lifecycle_state`.

A pure model builder converts those rows into at most ten stable topology nodes. Node state is derived as follows:

- `risk`: the asset has at least one active finding.
- `pending`: the asset is not verified and has no active finding in the selected result set.
- `healthy`: the asset is verified and has no active finding in the selected result set.

The model exposes the highest severity for each asset using the order `critical > high > medium > low > info`. It never infers exploitability or an attack path.

## WebGL renderer

Use raw WebGL with no new runtime dependency.

The renderer owns only visual geometry:

- central hub and rotating aperture rings
- radial spokes from hub to asset nodes
- secondary wireframe branches around nodes
- point particles moving along selected spokes
- depth/parallax response to pointer movement
- subtle idle drift
- teal/cyan for verified healthy state
- amber for pending/unverified state
- orange/red for assets with findings

The renderer receives a frozen serializable node array. It does not receive Supabase clients, secrets, canonical finding evidence, worker authority, or raw security observations.

The canvas is `aria-hidden`. Equivalent asset labels and states remain in normal DOM content.

## Performance and fallbacks

- Cap device pixel ratio at 1.75.
- Pause animation when `document.hidden` is true.
- Stop continuous animation when `prefers-reduced-motion: reduce` matches; render a static first frame instead.
- If WebGL context creation or shader compilation fails, retain the CSS/SVG fallback and DOM labels.
- Keep the renderer below a few hundred vertices and particles. No textures, model downloads, or external shader assets.
- Mobile layout stacks editorial content above the scene and keeps the scene height bounded.

## Safari site identity

Use a dedicated versioned Forge Aperture icon URL rather than reusing the original `/icon.svg` URL for every role. Publish explicit SVG favicon/shortcut/apple metadata and a web-app manifest so Safari can refresh cached site identity and home-screen metadata.

## Scope boundaries

This change must not modify:

- Supabase schema, RLS, migrations, or database privileges
- repository worker runtime gates
- runtime observation or active validation authorization
- worker contracts or network authority
- finding persistence semantics
- Phase 6D architecture

## Verification

Before merge:

- browser-icon regression tests pass
- topology model tests pass
- scene structural/fallback tests pass
- full test suite passes when an independent verifier is available
- TypeScript typecheck passes
- production Next.js build passes
- Vercel preview renders the first viewport when preview environment configuration is available
- reduced-motion and mobile CSS paths are reviewed
- final diff contains only UI, brand metadata, tests, and documentation
