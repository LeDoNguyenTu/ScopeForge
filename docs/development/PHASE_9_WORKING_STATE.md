# ScopeForge Phase 9 Working State

Last reconciled: 2026-09-09 (Asia/Singapore)

## Phase status

- Phase 9 architecture: approved
- Phase 9A authentication boundary: complete and released
- Phase 9B provider/auth hardening code: complete and released; external provider activation remains pending verification
- Phase 9C database/RPC defense-in-depth: complete and released
- Phase 9D security telemetry/browser hardening: implementation complete through Preview build; release acceptance in progress
- Phase 9E incident/release hardening: pending after 9D

## Authoritative production baseline

Current production docs baseline:

`2af9a92b68c224d290a9597ff1907e5f1098791e`

Current production executable release beneath that docs checkpoint:

`f203168e6ae25455743849f08511e371d3964153`

Current production tree for that executable release:

`9980aa5a58014998fd26ae7084bd97c992bc1a82`

The current production UI is authoritative. PR #49 remains an open draft legacy UI branch and is out of scope for Phase 9D.

## Phase 9D active branch

Branch:

`feat/phase-9d-security-telemetry-browser-hardening-v1`

Approved written spec:

`docs/superpowers/specs/2026-09-09-phase-9d-security-telemetry-browser-hardening-design.md`

Implementation plan:

`docs/superpowers/plans/2026-09-09-phase-9d-security-telemetry-browser-hardening.md`

Detailed resumable implementation state:

`docs/development/PHASE_9D_WORKING_STATE.md`

The implementation/evidence head `dfcd0403d84a01e2833d971e549323a03b67c094` passed an exact-head Vercel Preview build:

- deployment `dpl_8xMam5rVMmJnYQFMAgxpad2PB1A2`
- state READY
- `aliasError=null`
- Next.js production compile succeeded
- TypeScript validity check succeeded
- 10/10 static pages generated

The later documentation checkpoint accidentally introduced `docs/development/PHASE_9_WORKING_STATE.tmp`; it was removed explicitly in `fc7a32bf2592236527fb5540ad546f9096b690ba`. No executable file changed in that cleanup.

## Phase 9D implemented behavior

Operational telemetry now uses one bounded closed schema:

`scopeforge.security.v1`

Implemented worker event names:

- `worker.authentication_rejected`
- `worker.access_rejected`
- `worker.rate_limited`
- `worker.request_failed`

A bounded `security.control_misconfigured` event shape is also defined for future fixed-control call sites.

Telemetry is emitted only from the centralized worker HTTP error boundary. Fixed compile-time route identities are used for claim, heartbeat, finalize, repository-scan artifact/finalize, and runtime prepare/finalize. The logger rebuilds an allowlisted object, caps serialized output at 1024 UTF-8 bytes, silently drops invalid telemetry, and never receives request objects, headers, cookies, bodies, IDs, credentials, lease tokens, source content, executor output, or raw exception messages.

Normal worker protocol/state 400 and 409 errors are not treated as security telemetry by default. Existing status maps, response bodies, cache behavior, authentication, task state, and lease state remain unchanged.

## Durable audit hardening

`lib/audit/write-audit-event.ts` now exposes a pure recursive metadata validator used by the existing writer.

The application continues to enforce the existing 8 KiB audit metadata ceiling and rejects credential-like keys plus exact normalized content-bearing keys such as request/response bodies, source/source code, stdout/stderr, environment, and headers. Benign descriptors such as `sourceType` remain valid.

No database migration or second audit/telemetry table was added.

## Browser hardening and CSP truth

Existing browser security headers are pinned by architecture tests:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- restrictive `Permissions-Policy`
- HSTS preload value
- `poweredByHeader: false`

CSP state: NOT ENFORCED.

Source inventory proves a strict CSP is not yet safe because the current production UI contains legitimate React inline style attributes and Next.js framework bootstrap/hydration requires exact nonce/hash compatibility work. Broad permanent `unsafe-inline` or `unsafe-eval` is not approved merely to claim CSP coverage.

Observed browser provider origins are limited to the configured Supabase HTTPS origin and Cloudflare Turnstile `https://challenges.cloudflare.com` when configured. No application Realtime channel use was found, so no speculative WebSocket origin is approved.

Full evidence and rollback/alert contracts:

`docs/security/PHASE_9D_TELEMETRY_AND_CSP.md`

## Test and build truth

Test-first commit ordering was preserved for the new telemetry, audit, worker-classification, route-identity, and architecture contracts.

This harness has no local executable ScopeForge checkout, so focused RED/GREEN execution has not been claimed. Intermediate commits use `[skip ci]`. The frozen GitHub Actions candidate remains the required executable Vitest/full-suite proof.

The complete implementation/evidence head `dfcd040...` has already passed Vercel production compilation and TypeScript validation.

## Current provider/runtime truth

Still intentionally not claimed:

- production Turnstile enforcement
- leaked-password protection enabled
- Vercel project-specific WAF custom rules active
- Vercel automated alert rules active
- CSP enforcement

Keep false/absent:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Remaining Phase 9D release gates

1. require an exact-head READY Preview for the final checkpoint head
2. issue one harmless unauthenticated POST to that Preview `/api/internal/workers/claim`
3. require the existing bounded 401 response
4. inspect exact-deployment Vercel Runtime Logs and prove one `scopeforge.security.v1` `worker.authentication_rejected` event containing only allowlisted fields
5. record runtime acceptance evidence
6. refresh `main` and preserve any newer production UI if overlap appears
7. freeze a tree-identical release candidate
8. require exact-candidate Preview READY
9. open/review the Phase 9D PR against actual current `main`
10. run one substantive candidate CI and require the full permanent gate set to pass
11. squash merge only the exact verified candidate
12. independently verify post-merge main CI and exact production deployment
13. write a docs-only Phase 9D release checkpoint and Phase 9E handoff

## Phase 9E direction

After Phase 9D release, complete vulnerability disclosure, incident response, credential rotation, rollback, impact assessment, recovery validation, and final public-launch security procedures.
