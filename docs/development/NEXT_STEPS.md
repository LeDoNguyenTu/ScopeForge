# ScopeForge Next Steps

Last reconciled: 2026-09-09 (Asia/Singapore)

## Completed boundaries

Do not recreate these released phases:

- Phase 7 Community Security Packs v1
- Phase 8A offline accuracy foundation
- Phase 8B scanner performance matrix
- Phase 8C reproducible technical publication
- Phase 9A authentication-boundary hardening
- Phase 9B provider/auth hardening code
- Phase 9C database/RPC defense-in-depth
- Phase 9D security telemetry/browser hardening
- Phase 9E incident readiness and release engineering

Current production `main`:

`6c6c07b070d2751a96729d3e58a86414ae148edc`

Current production tree:

`91bbc94f5c3c00050da21a4b5288bc17b0847540`

Exact production deployment:

`dpl_5sQid6VJ4xC2BS7iYrHBYUrzzQFP`

Production is READY on the exact released SHA, post-merge CI #782 passed, and a fresh GET to `scopeforge.dev` returned HTTP 200 with the accepted V5 desktop/mobile composition and poster assets.

## Immediate priority - strict CSP compatibility gate

Strict CSP is the next engineering boundary.

The goal is to add a useful enforced Content Security Policy without breaking the current Next.js application, Supabase browser flows, Command Center V5 loading, WebGL/Three.js behavior, or public navigation.

Required work:

1. Inventory the exact current browser resource requirements from the released tree and production response.
2. Define a narrow candidate policy by directive instead of starting from permissive wildcards.
3. Avoid broad permanent `unsafe-inline` and `unsafe-eval` shortcuts.
4. Add repository tests for the intended policy and for accidental regressions.
5. Validate landing page, V5 desktop/mobile, authentication pages, Supabase browser requests, static assets, fonts/images, and any required worker/blob behavior against the candidate.
6. Keep rollback straightforward by isolating CSP changes from unrelated product work.
7. Require exact-head CI and Vercel Preview before merge.
8. After merge, require independent `main` CI, exact production deployment verification, fresh HTTP header inspection, and V5 preservation evidence.

Do not mix provider activation, database changes, runtime enablement, scanner changes, or UI redesign into the CSP gate.

## Provider follow-up remains separate

Current truth:

- leaked-password protection is verified disabled
- production Turnstile enforcement is not verified
- Vercel project-specific custom WAF rule state is not verified
- CSP is currently not enforced

Provider activation must use a supported inspected surface and record rollback and verification evidence. Do not infer provider state from application source.

## Branch cleanup

Historical completed `diag/*`, `preview/*`, reconciliation, documentation, and feature branches should be deleted once a genuine delete-ref operation is available.

The current connected GitHub write surface cannot physically delete refs. Do not simulate deletion by moving old branch pointers to `main`.

## UI baseline rule

The released production `main` tree is authoritative. Preserve Command Center UI V5. Do not use stale V4, preview, diagnostic, or reconciliation branches as implementation bases.
