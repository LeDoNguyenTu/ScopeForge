# ScopeForge Phase 9D Release State

Last reconciled: 2026-09-09 (Asia/Singapore)

## Status

Phase 9D security telemetry and browser hardening is released.

Released pull request:

`#62 - Phase 9D security telemetry and browser hardening - V5 reconciled`

Verified final PR head:

`da5d090632b06fbf53d24eb09a0de5baac80c442`

Squash merge on `main`:

`27adf376b77c08fe95bbf64f7fc7a4df7ce5efe0`

Released tree:

`007474c194f687f126c000d98b1d1ed3a5d032d9`

The stale pre-V5 PR #61 was closed as superseded and was not merged.

## Final candidate evidence

The exact PR #62 head `da5d090632b06fbf53d24eb09a0de5baac80c442` passed the permanent repository validation workflow before merge.

GitHub Actions run:

- run `34294665698`
- workflow `CI`
- job `validate`
- conclusion `success`

The final-head gate covered:

- deterministic `npm ci`
- `npm audit --audit-level=info`
- full Vitest suite
- TypeScript typecheck
- CLI build and version execution
- historical scanner benchmark
- Phase 8B benchmark matrix
- production Next.js build

The exact-head Vercel Preview was also READY:

- deployment `dpl_BVCe1V9fjLtDAKwzAoDqxQoSSSYB`
- exact Git SHA `da5d090632b06fbf53d24eb09a0de5baac80c442`
- state READY
- `aliasError=null`

Final changed-file review showed the Phase 9D candidate did not modify the accepted Command Center UI V5 presentation paths. There were no unresolved inline review threads or submitted review blocks before the pinned-head merge.

## Independent post-merge validation

The squash merge produced `main` SHA:

`27adf376b77c08fe95bbf64f7fc7a4df7ce5efe0`

Independent post-merge GitHub Actions validation completed successfully:

- run `34311757445`
- run number `780`
- exact head SHA `27adf376b77c08fe95bbf64f7fc7a4df7ce5efe0`
- job `validate`
- conclusion `success`
- completed `2026-09-09T04:42:32Z`

Every permanent validation step completed successfully, including the final production Next.js build.

## Production deployment

The exact merged SHA is deployed to production:

- deployment `dpl_ExY8TxoHpFT7wsiMwg3w4BTUNE8V`
- target `production`
- exact Git SHA `27adf376b77c08fe95bbf64f7fc7a4df7ce5efe0`
- state READY
- `aliasError=null`
- aliases include `scopeforge.dev`

A fresh GET to `https://scopeforge.dev` returned HTTP 200 after the Phase 9D deployment and still served the accepted V5 surface, including:

- `data-testid="command-center-v5-desktop"`
- `data-testid="command-center-v5-mobile"`
- `/command-center-v5-poster-desktop.webp`
- `/command-center-v5-poster-mobile.webp`

The response continued to include the existing browser-header baseline covered by Phase 9D architecture tests.

No pixel-level screenshot comparison is claimed because this chat harness does not provide the required browser screenshot executor. UI preservation is supported by source-path isolation, V5 regression coverage, exact builds, deployment identity, and the fresh production DOM/asset check.

## Released behavior

Phase 9D released bounded operational security telemetry under schema:

`scopeforge.security.v1`

Closed event names:

- `worker.authentication_rejected`
- `worker.access_rejected`
- `worker.rate_limited`
- `worker.request_failed`
- `security.control_misconfigured`

Telemetry remains server-side and privacy-reduced. It is emitted from the centralized worker HTTP error boundary using fixed compile-time route identifiers and bounded allowlisted fields. It does not serialize raw request objects, credentials, authorization material, source content, executor output, or arbitrary exception payloads.

The existing durable `audit_events` path was hardened with recursive metadata validation and retains its existing 8 KiB serialized metadata ceiling. No new durable telemetry table and no database migration were introduced in Phase 9D.

## Browser hardening truth

The existing security-header baseline remains pinned by architecture tests.

CSP state remains:

`NOT ENFORCED`

Strict CSP still requires a separate exact compatibility gate for the current Next.js and V5 runtime. A broad permanent `unsafe-inline` or `unsafe-eval` policy is not an approved substitute.

## Provider and runtime truth

Phase 9D does not claim any of the following as enabled or verified:

- production Turnstile enforcement
- Supabase leaked-password protection
- Vercel project-specific custom WAF rules
- Vercel automated security alerts
- CSP enforcement
- a protected Preview POST plus Runtime Log observation proving `worker.authentication_rejected` in provider logs

The Runtime Log acceptance probe remains an explicitly unresolved operational observation, not a release claim.

The following hosted runtime flags remain false or absent unless separately accepted:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Next boundary

Proceed to Phase 9E incident readiness and final launch-gate engineering from exact production `main`.

Phase 9E must preserve the released V5 UI and all established authorization/runtime boundaries. Provider activation remains separately verified operational work, not something implied by the Phase 9D code release.
