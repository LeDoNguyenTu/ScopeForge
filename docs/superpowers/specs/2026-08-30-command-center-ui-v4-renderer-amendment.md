# ScopeForge Command Center UI v4 Renderer Amendment

Date: 2026-08-30
Status: Implementation amendment

The approved v4 visual, responsive, loading, animation, accessibility, and security requirements remain unchanged.

During execution, the connector-only environment exposed a reproducibility constraint: adding a new npm graphics dependency would require regenerating and committing `package-lock.json`, but this session does not provide a safe package-manager write path into the GitHub branch. ScopeForge must not ship with a stale lockfile.

Therefore the v4 renderer will use an advanced zero-dependency raw WebGL implementation instead of adding Three.js as a runtime dependency.

The renderer must still provide the approved visual contract:

- dimensional six-arm attack-surface structure
- central Forge Aperture hub and layered rings
- structural truss geometry and endpoint towers
- translucent panel geometry
- healthy teal/cyan channels
- risk orange/red channels
- additive glow passes
- moving scan pulses and pulse trails
- atmospheric particles
- depth/fog shading
- low-amplitude camera drift and pointer parallax
- adaptive desktop/tablet/mobile quality tiers
- reduced-motion mode
- visibility-aware animation pause
- bounded DPR
- cold-load initialization progress
- warm repeat-visit bypass
- SVG/DOM fallback when WebGL is unavailable

No visual requirement is reduced by this amendment. The implementation should prefer precomputed typed-array geometry, pooled pulse buffers, and multiple lightweight WebGL draw passes over runtime object allocation.

No npm dependency is added by this amendment.
