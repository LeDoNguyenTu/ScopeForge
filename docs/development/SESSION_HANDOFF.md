# ScopeForge Session Handoff

Last refreshed: 2026-09-09 (Asia/Singapore)

Use this as the fastest resume point for ScopeForge Phase 9 hardening.

## Hard execution rules

- production `main` is always the authoritative integration baseline
- preserve the accepted Command Center UI V5 unless a separate UI change is explicitly authorized
- before freezing or merging a Phase 9 branch, re-read `main`, exact PR head, changed files, reviews, threads, CI, and Vercel deployment state
- do not use GitHub Actions as a blind debugging loop; diagnose failures first
- reserve substantive CI for exact release candidates
- never rewrite deployed Supabase migrations
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim tests, provider state, WAF state, alerts, CSP, or production enforcement without exact evidence
- do not enable hosted worker/runtime capability flags as part of Phase 9 hardening

## Current production baseline

Current production `main` before Phase 9D release:

`e506c4da3777f9256b8d14e2aa4780a07769b29d`

Tree:

`41c4e7aabf05c19a21a00fdd941659b22dcfd07b`

This is the accepted Command Center UI V5 release. The pre-merge V5 candidate had the same tree, so PR #49 preserved the accepted candidate exactly at Git-tree level.

Production Vercel deployment:

- `dpl_8p4Ha8eVbF7tstZuDRWZXGwjggQ8`
- exact Git SHA `e506c4da3777f9256b8d14e2aa4780a07769b29d`
- target production
- READY
- `aliasError=null`
- aliases include `scopeforge.dev`

A fresh production GET returned HTTP 200 and the expected V5 desktop/mobile composition markers, attack-surface scene marker, and V5 poster assets.

## Active Phase 9D integration

Branch:

`reconcile/phase-9d-v5-main`

PR:

`#62 - Phase 9D security telemetry and browser hardening - V5 reconciled`

Base:

`e506c4da3777f9256b8d14e2aa4780a07769b29d`

The original pre-V5 PR #61 is stale and superseded. Do not merge #61.

Key docs:

- approved spec: `docs/superpowers/specs/2026-09-09-phase-9d-security-telemetry-browser-hardening-design.md`
- implementation plan: `docs/superpowers/plans/2026-09-09-phase-9d-security-telemetry-browser-hardening.md`
- active state: `docs/development/PHASE_9D_WORKING_STATE.md`
- V5 reconciliation evidence: `docs/development/PHASE_9D_V5_RECONCILIATION.md`
- telemetry/CSP evidence: `docs/security/PHASE_9D_TELEMETRY_AND_CSP.md`

The original spec/plan preserve historical implementation context from the pre-V5 branch. The active state and reconciliation docs are authoritative for the release integration baseline.

## Working UI preservation

The accepted V5 UI is a hard Phase 9D merge gate.

PR #62 must contain no changes to:

- `app/layout.tsx`
- `app/command-center-v5.css`
- `components/landing/CommandCenterLandingHero.tsx`
- `components/landing/CommandCenterHeroDesktopV5.tsx`
- `components/landing/CommandCenterHeroMobileV5.tsx`
- `components/landing/AttackSurfaceSceneV5.tsx`
- `components/landing/attack-surface-v5/**`
- `components/PublicNav.tsx`
- `components/PublicFooter.tsx`
- V5 poster assets

No fresh pixel-level screenshot claim is available in this chat harness. Preserve UI confidence through exact source/tree comparison, V5 tests, Vercel builds, and live production DOM/assets checks.

## What Phase 9D implements

- closed `scopeforge.security.v1` server telemetry schema
- bounded allowlisted JSON events, maximum 1024 UTF-8 bytes
- centralized worker HTTP classification for authentication rejection, access rejection, active-limit rate limiting, and unexpected 500 failures
- fixed compile-time route IDs on all seven internal worker endpoints
- no security telemetry for ordinary 400/409 protocol/state conflicts by default
- no request objects, headers, cookies, bodies, IDs, credentials, lease tokens, source content, raw executor output, or raw exception messages in the telemetry contract
- recursive audit metadata hardening while preserving the existing 8 KiB audit metadata ceiling
- regression coverage for the existing browser security-header baseline
- evidence-based CSP inventory and rollback/alert contracts

No database migration, new audit store, RLS/provider/WAF mutation, UI rewrite, root layout change, CSP enforcement, or hosted-runtime activation is part of the Phase 9D security behavior.

## V5 reconciliation compatibility changes

To make Phase 9D executable on the current V5 dependency tree, the branch also contains narrow dependency/test-tool compatibility updates:

- Vitest `^4.1.11`
- existing `sharp` override `0.35.4`
- compatible Vitest JSX transform configuration
- regenerated lockfile
- two type-only test-helper compatibility annotations

These files do not alter accepted presentation source.

A Vitest 4 typecheck failure was root-caused to a zero-argument default mock narrowing `RepositorySnapshotObjectStore.deleteObject(objectKey)`. The helper is now typed to the exact interface function type.

## Executable evidence

Dedicated reconciliation run `34293520967` completed successfully:

- npm install state validated
- `npm audit --audit-level=info`: 0 vulnerabilities
- full Vitest suite: 350 files / 1538 tests passed
- TypeScript typecheck passed
- CLI build/version passed
- scanner benchmark passed
- Phase 8B benchmark matrix passed
- production Next.js build passed

The V5 tests are part of that full suite.

The temporary reconciliation workflow was removed before the intended merge diff.

PR #62 must still pass the permanent standard `CI / validate` gate on the exact final head. If the head changes, only a new run on that head counts.

## CSP and provider truth

CSP: NOT ENFORCED.

Do not add broad permanent `unsafe-inline` or `unsafe-eval`. Strict CSP remains deferred until the current V5/Next.js inline-style and bootstrap/hydration path has exact nonce/hash compatibility.

Current provider claims remain conservative:

- production Turnstile enforcement: NOT CLAIMED
- Supabase leaked-password protection: NOT ENABLED
- Vercel custom WAF rules: NOT CLAIMED
- Vercel automated security alerts: NOT CLAIMED
- protected Preview POST plus Runtime Log authentication-rejection observation: NOT VERIFIED in this harness

## Hosted runtime flags

Keep all four false/absent until their independent operational acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Immediate next actions

1. require exact final-head PR #62 Vercel Preview READY with `aliasError=null`
2. require exact final-head permanent `CI / validate` success
3. refresh changed filenames and prove no accepted V5 presentation path is present
4. refresh current `main`, PR mergeability, submitted reviews, and inline review threads
5. merge PR #62 only with the exact verified head SHA pinned
6. close stale PR #61 as superseded after #62 is safely integrated
7. require independent post-merge `main` CI success
8. require a READY production deployment whose Git SHA equals the merged `main` SHA
9. GET `https://scopeforge.dev/` again and verify the expected V5 DOM/assets markers remain served
10. write a docs-only Phase 9D release checkpoint without overstating the unresolved Runtime Log acceptance probe
11. continue to Phase 9E incident/release engineering using the normal design/spec/plan gates