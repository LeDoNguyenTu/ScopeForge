# ScopeForge Phase 9 Working State

Last reconciled: 2026-09-09 (Asia/Singapore)

## Phase status

- Phase 9 architecture: approved
- Phase 9A authentication boundary: complete and released
- Phase 9B provider/auth hardening code: complete and released; external provider activation remains pending direct verification where documented
- Phase 9C database/RPC defense-in-depth: complete and released
- Phase 9D security telemetry/browser hardening: implementation complete, reconciled onto Command Center UI V5, release acceptance in progress through PR #62
- Phase 9E incident/release engineering: pending after Phase 9D release

## Authoritative production baseline

Current production `main` for the Phase 9D release attempt:

`e506c4da3777f9256b8d14e2aa4780a07769b29d`

Tree:

`41c4e7aabf05c19a21a00fdd941659b22dcfd07b`

This is the merged Command Center UI V5 release. The accepted V5 candidate before PR #49 merged had the same tree, so the V5 merge preserved the accepted candidate exactly at Git-tree level.

Production Vercel deployment:

- `dpl_8p4Ha8eVbF7tstZuDRWZXGwjggQ8`
- target production
- exact Git SHA `e506c4da3777f9256b8d14e2aa4780a07769b29d`
- READY
- `aliasError=null`
- aliases include `scopeforge.dev`

A fresh production GET returned HTTP 200 with the expected V5 desktop/mobile composition markers, V5 attack-surface scene marker, and both V5 poster assets.

## Phase 9D active integration

Branch:

`reconcile/phase-9d-v5-main`

PR:

`#62 - Phase 9D security telemetry and browser hardening - V5 reconciled`

The stale pre-V5 PR #61 is superseded and must not be merged.

Approved written spec:

`docs/superpowers/specs/2026-09-09-phase-9d-security-telemetry-browser-hardening-design.md`

Implementation plan:

`docs/superpowers/plans/2026-09-09-phase-9d-security-telemetry-browser-hardening.md`

Current resumable implementation state:

`docs/development/PHASE_9D_WORKING_STATE.md`

V5 reconciliation evidence:

`docs/development/PHASE_9D_V5_RECONCILIATION.md`

Operational/CSP evidence:

`docs/security/PHASE_9D_TELEMETRY_AND_CSP.md`

## UI preservation rule

The accepted V5 UI is a release invariant for Phase 9D.

PR #62 contains no changes to the V5 landing scene, V5 CSS, root layout, public navigation/footer, or V5 poster assets. Phase 9D executable changes are confined to server-side security telemetry/audit boundaries and fixed internal worker route identifiers. Dependency/test-tool compatibility changes do not edit presentation source.

No new pixel-level screenshot claim is made because this chat harness has no executable browser screenshot resource. UI preservation is supported by accepted/merged tree equality, unchanged UI source paths, V5 regression tests, exact Vercel builds, and fresh production DOM/assets verification.

## Phase 9D implemented behavior

Operational security telemetry uses the bounded closed schema:

`scopeforge.security.v1`

Implemented event names:

- `worker.authentication_rejected`
- `worker.access_rejected`
- `worker.rate_limited`
- `worker.request_failed`
- `security.control_misconfigured`

Telemetry is emitted from the centralized worker HTTP error boundary with fixed compile-time route identities for all seven internal worker endpoints. The logger reconstructs allowlisted fields, caps serialized output at 1024 UTF-8 bytes, and never accepts raw request objects, headers, cookies, bodies, IDs, credentials, lease tokens, source content, executor output, or raw exception messages.

Normal worker protocol/state 400 and 409 errors are not security telemetry by default. Existing response/status behavior remains unchanged.

## Durable audit hardening

`lib/audit/write-audit-event.ts` exposes a pure recursive metadata validator used by the existing audit writer.

The application preserves the existing 8 KiB audit metadata ceiling and rejects credential-like plus exact normalized content-bearing keys. No database migration or second audit/telemetry table was introduced.

## Dependency reconciliation truth

The original Phase 9D plan was written before the V5 integration and therefore describes its historical branch/base and original dependency assumptions. The V5 reconciliation required a narrow package/test-tool compatibility update:

- Vitest `^4.1.11`
- existing `sharp` override `0.35.4`
- compatible Vitest JSX transform configuration
- deterministic lockfile regeneration
- two type-only test-helper compatibility annotations

These reconciliation changes were required to validate Phase 9D on current V5 `main`. They do not alter the V5 UI source.

## Test and build truth

Dedicated reconciliation run `34293520967` succeeded and proved:

- `npm ci`
- `npm audit --audit-level=info` with 0 vulnerabilities
- full Vitest suite: 350 test files, 1538 tests passed
- TypeScript typecheck
- CLI build/version
- historical scanner benchmark
- Phase 8B benchmark matrix
- production Next.js build

The suite includes the V5 hero, scene, geometry, model, quality, controller, progress, and architecture coverage.

The final PR head must also pass the permanent repository `CI / validate` workflow. Evidence from an older SHA cannot be reused if the candidate head moves.

## Browser hardening and CSP truth

Existing security headers remain pinned by architecture tests.

CSP state: NOT ENFORCED.

Strict CSP remains deferred until the V5/Next.js inline-style/bootstrap path has exact nonce/hash compatibility. Broad permanent `unsafe-inline` or `unsafe-eval` is not approved.

## Current provider/runtime truth

Still intentionally not claimed:

- production Turnstile enforcement
- Supabase leaked-password protection enabled
- Vercel project custom WAF rules active
- Vercel automated security alerts active
- CSP enforcement
- real protected Preview POST plus Runtime Log observation of the authentication-rejection telemetry event

Keep false/absent:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Remaining Phase 9D release gates

1. exact final-head Vercel Preview READY with `aliasError=null`
2. exact final-head permanent `CI / validate` success
3. final changed-file/review/mergeability refresh proving the V5 UI preservation boundary remains intact
4. expected-head protected merge of PR #62
5. independent post-merge `main` CI success
6. exact merged-SHA production Vercel deployment
7. fresh production HTTP check proving the V5 surface is still served
8. docs-only Phase 9D release record with the Runtime Log acceptance probe still marked unresolved unless directly observed

## Phase 9E direction

After Phase 9D release, proceed to incident/release engineering: vulnerability disclosure, incident response, credential rotation, rollback, impact assessment, recovery validation, and final public-launch security procedures.