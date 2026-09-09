# ScopeForge Phase 9D Working State

Last reconciled: 2026-09-09 (Asia/Singapore)

## Status

Phase 9D implementation is complete and reconciled onto the accepted Command Center UI V5 production baseline. Release acceptance is in progress through PR #62.

Active branch:

`reconcile/phase-9d-v5-main`

Active PR:

`#62 - Phase 9D security telemetry and browser hardening - V5 reconciled`

Production base for this release attempt:

`e506c4da3777f9256b8d14e2aa4780a07769b29d`

Production base tree:

`41c4e7aabf05c19a21a00fdd941659b22dcfd07b`

The accepted V5 candidate before PR #49 merged had the same tree. Therefore the V5 merge itself preserved the accepted UI exactly at Git-tree level.

The original pre-V5 Phase 9D PR #61 is stale and must not be merged. PR #62 supersedes it.

## UI preservation invariant

Phase 9D must not modify the accepted working UI.

The reconciled PR diff contains no changes to:

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

Production deployment `dpl_8p4Ha8eVbF7tstZuDRWZXGwjggQ8` is READY on exact SHA `e506c4da3777f9256b8d14e2aa4780a07769b29d` with `aliasError=null`. A fresh GET to `https://scopeforge.dev/` returned HTTP 200 and the expected V5 desktop/mobile composition markers, attack-surface scene marker, and V5 poster assets.

No browser screenshot executor is available in this chat harness, so do not claim a new pixel-by-pixel screenshot comparison. UI preservation is grounded in exact tree equality for the accepted V5 merge, source-path isolation, V5 tests, Vercel builds, and live production DOM/assets verification.

## Implemented operational telemetry

New module:

`lib/security/telemetry.ts`

Schema:

`scopeforge.security.v1`

Closed events:

- `worker.authentication_rejected`
- `worker.access_rejected`
- `worker.rate_limited`
- `worker.request_failed`
- `security.control_misconfigured`

Worker telemetry is restricted to bounded allowlisted fields:

- schema
- event
- severity
- fixed route
- bounded application code
- HTTP status

The logger rebuilds normalized data rather than serializing caller input, caps one event at 1024 UTF-8 bytes, has a browser-runtime guard, and silently drops telemetry failures so observability cannot alter protected request behavior.

## Worker classification

`workerRouteError` requires one compile-time `WorkerSecurityRoute` identifier.

Classification:

- broker authentication rejection -> `worker.authentication_rejected`, warning, 401
- `WORKER_DISABLED`, `WORKER_NOT_AVAILABLE`, `RUNTIME_WORKER_ACCESS_DENIED` -> `worker.access_rejected`, warning, 403
- `RUNTIME_WORKER_ACTIVE_LIMIT` -> `worker.rate_limited`, warning, 429
- unknown exception -> `worker.request_failed`, error, 500
- ordinary 400/409 protocol or state failures -> no operational security event

Existing status maps and response body shapes are preserved.

Fixed route IDs:

- claim -> `worker.claim`
- heartbeat -> `worker.heartbeat`
- finalize -> `worker.finalize`
- repository scan artifact -> `worker.repository_scan_artifact`
- repository scan finalize -> `worker.repository_scan_finalize`
- runtime prepare -> `worker.runtime_prepare`
- runtime finalize -> `worker.runtime_finalize`

## Durable audit hardening

`lib/audit/write-audit-event.ts` exports the recursive validator `assertSafeAuditMetadata`.

The existing 8 KiB serialized metadata ceiling remains. Credential-like and exact normalized content-bearing keys are rejected, including request/response bodies, source/source code, stdout/stderr, environment, and headers. Benign descriptors such as `sourceType` remain allowed.

No database migration and no second durable telemetry/audit store were added.

## Dependency and test-tool reconciliation

Reconciling the pre-V5 Phase 9D work onto current V5 `main` required dependency/test-tool compatibility updates:

- Vitest updated from the earlier 3.x range to `^4.1.11`
- the existing `sharp` override moved to `0.35.4`
- Vitest JSX transform configuration was migrated to the compatible Oxc path
- `package-lock.json` was regenerated deterministically
- two test helpers received type-only compatibility annotations for Vitest 4

These changes do not alter landing/V5 presentation source.

A Vitest 4 type-inference failure in `tests/repository-snapshots/cleanup.test.ts` was traced to a zero-argument default mock narrowing the real `deleteObject(objectKey: string): Promise<void>` interface. The helper is now typed to `RepositorySnapshotObjectStore["deleteObject"]`.

## Executable reconciliation evidence

Dedicated reconciliation workflow run:

- run `34293520967`
- conclusion: success

It proved:

- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm audit --audit-level=info` with 0 vulnerabilities
- full Vitest suite: 350 test files, 1538 tests passed
- `npm run typecheck`
- `npm run build:cli`
- CLI version execution
- `npm run benchmark:scanner`
- `npm run benchmark:matrix`
- production `npm run build`

The full suite includes the V5 hero, scene, model, geometry, quality, controller, progress, and architecture tests.

The temporary reconciliation workflow used to generate/validate compatibility artifacts was removed before the PR candidate and is not part of the intended merge diff.

PR #62 also requires the normal permanent `CI / validate` workflow on the exact final head before merge. If the head changes for any reason, rerun the permanent gate and do not reuse evidence from an older SHA.

## Browser hardening and CSP truth

Existing browser security headers are pinned by architecture tests:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- restrictive `Permissions-Policy`
- HSTS preload value
- `poweredByHeader: false`

CSP state: NOT ENFORCED.

The current V5/Next.js surface still needs exact nonce/hash compatibility work before strict CSP enforcement. Broad permanent `unsafe-inline` or `unsafe-eval` is not an approved shortcut.

## Provider and runtime truth

Still intentionally not claimed:

- production Turnstile enforcement
- Supabase leaked-password protection enabled
- Vercel custom WAF rules active
- Vercel automated security alerts active
- CSP enforcement
- protected Preview POST plus Runtime Log proof of `worker.authentication_rejected`

Keep false/absent:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Current release gates

Before PR #62 can merge:

1. exact final-head Vercel Preview must be READY with `aliasError=null`
2. normal repository `CI / validate` must succeed on the exact final head
3. changed-file review must continue to show no accepted UI presentation files
4. refresh `main`, PR mergeability, submitted reviews, and inline review threads
5. merge only with expected-head protection on the exact verified SHA
6. require independent post-merge `main` CI success
7. require exact production Vercel deployment for the merged SHA
8. issue a fresh production GET and verify the V5 surface markers/assets remain served
9. record Phase 9D release state without overstating the unresolved Runtime Log acceptance probe

After Phase 9D is released, proceed to Phase 9E incident/release engineering.