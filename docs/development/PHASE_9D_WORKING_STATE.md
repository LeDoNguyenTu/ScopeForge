# ScopeForge Phase 9D Working State

Last reconciled: 2026-09-09 (Asia/Singapore)

## Status

Phase 9D implementation, reconciliation, merge, independent `main` validation, and production deployment are complete.

Authoritative release record:

`docs/development/PHASE_9D_RELEASE_STATE.md`

Released PR:

`#62 - Phase 9D security telemetry and browser hardening - V5 reconciled`

Final PR head:

`da5d090632b06fbf53d24eb09a0de5baac80c442`

Released `main` SHA:

`27adf376b77c08fe95bbf64f7fc7a4df7ce5efe0`

Released tree:

`007474c194f687f126c000d98b1d1ed3a5d032d9`

The original pre-V5 PR #61 was closed as superseded and was not merged.

## UI preservation invariant

Phase 9D did not modify the accepted Command Center UI V5 presentation paths.

The exact merged production deployment is READY and a fresh production GET returned HTTP 200 with the V5 desktop/mobile composition markers and both V5 poster assets still served.

No pixel-level screenshot comparison is claimed in this harness. UI preservation evidence consists of source-path isolation, V5 regression coverage, exact candidate and post-merge builds, exact production deployment identity, and fresh production DOM/assets verification.

## Released operational telemetry

Module:

`lib/security/telemetry.ts`

Schema:

`scopeforge.security.v1`

Closed events:

- `worker.authentication_rejected`
- `worker.access_rejected`
- `worker.rate_limited`
- `worker.request_failed`
- `security.control_misconfigured`

Worker telemetry remains restricted to bounded allowlisted fields and fixed route identities. The logger rebuilds normalized data rather than serializing caller input, caps one event at 1024 UTF-8 bytes, and silently drops telemetry failures so observability cannot alter protected request behavior.

Normal worker protocol/state 400 and 409 errors are not security telemetry by default. Existing response and status behavior remains unchanged.

## Durable audit hardening

`lib/audit/write-audit-event.ts` exports the recursive validator `assertSafeAuditMetadata`.

The existing 8 KiB serialized metadata ceiling remains. Credential-like and exact normalized content-bearing keys are rejected. No database migration and no second durable telemetry/audit store were added.

## Dependency and test-tool reconciliation

The V5 reconciliation required narrow dependency/test-tool compatibility updates:

- Vitest `^4.1.11`
- existing `sharp` override `0.35.4`
- compatible Vitest JSX transform configuration
- deterministic `package-lock.json` regeneration
- two type-only test-helper compatibility annotations

These changes do not alter landing/V5 presentation source.

## Final candidate evidence

Exact PR head `da5d090632b06fbf53d24eb09a0de5baac80c442`:

- permanent CI run `34294665698`: success
- exact-head Vercel Preview `dpl_BVCe1V9fjLtDAKwzAoDqxQoSSSYB`: READY
- preview `aliasError=null`
- final changed-file review: no accepted V5 presentation paths
- no unresolved review threads

## Post-merge evidence

Released `main` SHA `27adf376b77c08fe95bbf64f7fc7a4df7ce5efe0`:

- independent CI run `34311757445`: success
- deterministic install: success
- npm audit: success
- full tests: success
- typecheck: success
- CLI build/version: success
- scanner benchmark: success
- benchmark matrix: success
- production Next.js build: success

Exact production deployment:

- `dpl_ExY8TxoHpFT7wsiMwg3w4BTUNE8V`
- target production
- exact SHA `27adf376b77c08fe95bbf64f7fc7a4df7ce5efe0`
- READY
- `aliasError=null`
- aliases include `scopeforge.dev`

Fresh production GET:

- HTTP 200
- V5 desktop composition present
- V5 mobile composition present
- desktop V5 poster present
- mobile V5 poster present

## Browser hardening and CSP truth

Existing browser security headers remain pinned by architecture tests.

CSP state: NOT ENFORCED.

The current V5/Next.js surface still requires exact nonce/hash compatibility work before strict CSP enforcement. Broad permanent `unsafe-inline` or `unsafe-eval` is not approved.

## Provider and runtime truth

Still intentionally not claimed:

- production Turnstile enforcement
- Supabase leaked-password protection enabled
- Vercel project custom WAF rules active
- Vercel automated security alerts active
- CSP enforcement
- protected Preview POST plus Runtime Log proof of `worker.authentication_rejected`

Keep false or absent:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Next step

Phase 9D is closed. Do not recreate or reopen it unless a concrete regression is found.

Proceed to Phase 9E incident readiness and final release engineering from the current production `main` baseline.
