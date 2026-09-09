# Phase 9D V5 Reconciliation Checkpoint

Date: 2026-09-09 (Asia/Singapore)

## Purpose

This checkpoint records the reconciliation of Phase 9D security telemetry and browser hardening onto the accepted Command Center UI V5 production base. The accepted V5 presentation is a release invariant: Phase 9D must not modify the working landing/dashboard UI.

## Accepted V5 production baseline

Current `main` before the Phase 9D release candidate:

`e506c4da3777f9256b8d14e2aa4780a07769b29d`

The accepted V5 integration candidate before merge was:

`2c2e333ed88902e613d8a7663de8891e68dcd363`

Its tree was:

`41c4e7aabf05c19a21a00fdd941659b22dcfd07b`

The merged `main` commit `e506c4da3777f9256b8d14e2aa4780a07769b29d` has the same tree:

`41c4e7aabf05c19a21a00fdd941659b22dcfd07b`

Therefore PR #49 preserved the accepted V5 candidate exactly at Git-tree level.

Production deployment:

- deployment `dpl_8p4Ha8eVbF7tstZuDRWZXGwjggQ8`
- target production
- Git SHA `e506c4da3777f9256b8d14e2aa4780a07769b29d`
- state READY
- `aliasError=null`
- aliases include `scopeforge.dev`

A fresh production GET to `https://scopeforge.dev/` returned HTTP 200 and the expected V5 surface markers, including both desktop and mobile compositions, the V5 attack-surface scene, and both V5 poster assets.

No browser screenshot executor is available in this chat harness, so this checkpoint does not claim a new pixel-by-pixel screenshot comparison. UI preservation is grounded in identical accepted/merged Git trees, unchanged UI source paths in Phase 9D, the V5 test suite, exact Vercel builds, and live production V5 DOM/assets verification.

## Reconciled Phase 9D branch

Branch:

`reconcile/phase-9d-v5-main`

PR:

`#62 - Phase 9D security telemetry and browser hardening - V5 reconciled`

Base:

`e506c4da3777f9256b8d14e2aa4780a07769b29d`

Clean executable reconciliation head before candidate documentation:

`4acebbd00b039c14d276e448a0d07f3624bc337e`

Initial candidate documentation head:

`96ccaf1c80cce7e41bc9f393f22f1ebb390801f9`

The branch is based directly on accepted V5 `main`; it does not merge the stale pre-V5 Phase 9D branch history into production. The original PR #61 is superseded and must not be merged.

A final documentation-consistency correction may move the PR head beyond `96ccaf1...`. For release acceptance, always use the current PR #62 head returned by GitHub and require all exact-head gates again. Do not reuse CI or Preview evidence from an older candidate SHA after the head moves.

## UI preservation boundary

The exact compare from the V5 production base to the reconciled branch contains no landing presentation, V5 scene, navigation, footer, or root layout source path.

In particular, Phase 9D does not change:

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

Phase 9D executable changes remain limited to the security telemetry/audit boundary and seven internal worker route identifiers. Reconciliation compatibility changes are limited to package metadata/lockfile, Vitest configuration, and two type-only test-helper annotations.

## Reconciliation validation evidence

Dedicated reconciliation workflow run:

- workflow `Reconcile Phase 9D`
- run `34293520967`
- validated source head `f3f4621bece95ee36484796640a7ba2edd7a41b0`
- conclusion success

The workflow generated and then committed deterministic compatibility changes as:

`048072bdff90830e9248f28fd36994c86bd30e88`

Generated commit scope:

- `package-lock.json`
- `tests/repository-scans/supervisor.test.ts`
- `tests/repository-snapshots/cleanup.test.ts`

The successful run proved:

- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm audit --audit-level=info` with 0 vulnerabilities
- full Vitest suite: 350 test files, 1538 tests passed
- `npm run typecheck`
- `npm run build:cli`
- CLI version execution
- `npm run benchmark:scanner`
- `npm run benchmark:matrix`
- production `npm run build`

The full suite includes the V5 landing/scene/model/geometry/quality/controller/progress/architecture tests.

A prior reconciliation run exposed one Vitest 4 type-inference incompatibility in the repository snapshot cleanup test helper. The failing typecheck was traced to a zero-argument default mock narrowing `deleteObject`, whose real interface is `deleteObject(objectKey: string): Promise<void>`. The helper was corrected to the exact interface function type, after which the full gate above passed.

The temporary self-modifying reconciliation workflow was removed in:

`4acebbd00b039c14d276e448a0d07f3624bc337e`

It is not part of the PR #62 changed-file set.

## Exact initial candidate Preview evidence

The initial frozen PR head `96ccaf1c80cce7e41bc9f393f22f1ebb390801f9` produced:

- deployment `dpl_CE2L1q9seTcGPGrQsu2D6giieFTr`
- target preview
- exact Git SHA `96ccaf1c80cce7e41bc9f393f22f1ebb390801f9`
- state READY
- `aliasError=null`

If the PR head moves after this checkpoint, require a new exact-head Preview before merge.

## Provider and authority truth

Phase 9D reconciliation does not change these facts:

- CSP: NOT ENFORCED
- production Turnstile enforcement: NOT CLAIMED
- Supabase leaked-password protection: NOT ENABLED
- Vercel custom WAF rules: NOT CLAIMED
- automated Vercel security alerts: NOT CLAIMED
- real Preview POST plus Runtime Log authentication-rejection observation: NOT VERIFIED in this harness

Keep false/absent:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Final release gate

PR #62 may merge only after all of the following are true on the exact current head:

1. Vercel Preview READY with `aliasError=null`
2. normal repository `CI / validate` success
3. final changed-file review proves the accepted V5 UI source boundary remains untouched
4. current `main`, mergeability, submitted reviews, and review threads are refreshed
5. merge uses expected-head protection for the exact verified SHA
6. independent post-merge `main` CI succeeds
7. production Vercel deployment is READY on the exact merged SHA
8. fresh production HTTP verification proves the V5 surface is still served
9. docs-only Phase 9D release record does not overstate the unresolved Runtime Log probe