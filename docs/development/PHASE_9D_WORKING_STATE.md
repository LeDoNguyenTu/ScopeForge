# ScopeForge Phase 9D Working State

Last reconciled: 2026-09-09 (Asia/Singapore)

## Status

Phase 9D implementation is complete through the first exact-head Preview build. Release validation is not complete yet.

Branch:

`feat/phase-9d-security-telemetry-browser-hardening-v1`

Production base:

`2af9a92b68c224d290a9597ff1907e5f1098791e`

Implementation/evidence head before this checkpoint:

`dfcd0403d84a01e2833d971e549323a03b67c094`

Tree:

`35d0307799fe964c5e33447ee987ba7809f4254c`

## Exact Preview evidence

Vercel Preview:

- deployment `dpl_8xMam5rVMmJnYQFMAgxpad2PB1A2`
- URL `https://scopeforge-flzp766z2-itsbrian.vercel.app`
- Git SHA `dfcd0403d84a01e2833d971e549323a03b67c094`
- target preview
- state READY
- `aliasError=null`
- Next.js production compile succeeded
- TypeScript validity check succeeded
- 10/10 static pages generated

This preview proves compile/type/build compatibility only. It does not prove the new Vitest contracts because this harness has no local repository checkout and intermediate GitHub Actions were deliberately suppressed.

## Scope from production base

The implementation/evidence head is 22 commits ahead and 0 behind the production base.

Changed files are limited to:

- seven internal worker route files, each with one fixed telemetry route-id argument
- `lib/security/telemetry.ts`
- `lib/audit/write-audit-event.ts`
- `lib/worker-control/http-response.ts`
- focused security/worker/architecture tests
- Phase 9D spec and implementation plan
- `docs/security/PHASE_9D_TELEMETRY_AND_CSP.md`

No package file, database migration, RLS policy, Supabase provider setting, Vercel WAF setting, `app/layout.tsx`, landing/dashboard visual file, or hosted-runtime flag changed.

Current `main` was refreshed immediately before this checkpoint and remains exactly:

`2af9a92b68c224d290a9597ff1907e5f1098791e`

Therefore no UI merge conflict exists at this checkpoint.

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

Worker fields are restricted to:

- schema
- event
- severity
- fixed route
- bounded application code
- HTTP status

Control-misconfiguration fields are restricted to:

- schema
- event
- severity
- fixed `security.config` route
- bounded control identifier

The logger rebuilds a normalized allowlisted object instead of serializing caller input, rejects invalid values, caps one serialized event at 1024 UTF-8 bytes, and silently drops telemetry failures so observability cannot change protected request behavior.

The logger is imported by the centralized server-side worker HTTP response module only. It has a browser-runtime guard and is not imported by client application components.

## Worker classification

`workerRouteError` now requires one compile-time `WorkerSecurityRoute` identifier.

Classification:

- broker auth rejection -> `worker.authentication_rejected`, warning, 401
- `WORKER_DISABLED`, `WORKER_NOT_AVAILABLE`, `RUNTIME_WORKER_ACCESS_DENIED` -> `worker.access_rejected`, warning, 403
- `RUNTIME_WORKER_ACTIVE_LIMIT` -> `worker.rate_limited`, warning, 429
- unknown exception -> `worker.request_failed`, error, 500
- ordinary 400/409 protocol/state failures -> no operational security event

All existing status maps and response body shapes remain unchanged by design.

Fixed route IDs:

- claim -> `worker.claim`
- heartbeat -> `worker.heartbeat`
- finalize -> `worker.finalize`
- repository scan artifact -> `worker.repository_scan_artifact`
- repository scan finalize -> `worker.repository_scan_finalize`
- runtime prepare -> `worker.runtime_prepare`
- runtime finalize -> `worker.runtime_finalize`

## Durable audit hardening

`lib/audit/write-audit-event.ts` now exports the pure recursive validator `assertSafeAuditMetadata`.

The runtime boundary continues rejecting credential-like metadata keys and now also rejects exact normalized content-bearing keys for request/response bodies, source/source code, stdout/stderr, environment, and headers.

Benign descriptors such as `sourceType` remain allowed. The existing 8 KiB serialized metadata ceiling remains unchanged.

A syntax error was caught during implementation in an intermediate commit: an invalid JavaScript regex `x` flag. Systematic debugging isolated it to the regex literal syntax and corrected it in `5aba9084b6de7bf7cfc468ebeef48b8ea4914cbe`. The complete `dfcd040...` Preview compiled successfully afterward.

## Test-first evidence

Test-first ordering is preserved:

- `288bf7a0286d02b7cf2ea60f36ba5a4b2efbbf5c` - telemetry contract before telemetry module
- `79dd235899bc63401298eb85f7dd559af211268d` - telemetry implementation
- `50f8c5756da7fb463afceeed1b7a57725eda1b9a` - audit metadata contract before exported/hardened validator
- `31fabd687badc2cf89f588f7d45d4515fc7525ff` - initial audit implementation
- `5aba9084b6de7bf7cfc468ebeef48b8ea4914cbe` - valid-regex correction after root-cause analysis
- `2a2dfe58e41cac7bcd49aad7b4a47f4e657c4558` - worker classification contract before shared-boundary integration
- `3a3656e7be363076d3fae0b1f1c5c40456795f8e` - centralized classification
- `ad332db138c05424f5a4a87ba247f2f367ffb70d` - fixed route-id contract before route call-site updates
- route identity implementation completed through `c4c4cb4170f60dafcf2b10d9e55ec9ac23defa1a`
- `7667509b441ea37f24918e39edf226cda0127a43` - Phase 9D architecture/browser contract before operations document
- `dfcd0403d84a01e2833d971e549323a03b67c094` - telemetry/CSP operational evidence document

Because this harness has no local executable repository checkout, focused RED/GREEN is structural rather than executed. Do not claim these new Vitest tests pass until the frozen GitHub Actions candidate executes them.

## Browser-hardening evidence

Current security headers are pinned by architecture tests:

- nosniff
- strict-origin referrer policy
- frame denial
- restrictive Permissions Policy
- HSTS preload value
- `poweredByHeader: false`

CSP state: NOT ENFORCED.

The source inventory proves strict CSP enforcement is not ready in this release because the current UI contains legitimate React inline style attributes and Next.js framework bootstrap/hydration requires exact nonce/hash compatibility work. Broad `unsafe-inline` and `unsafe-eval` are not approved shortcuts.

Observed external runtime resource/control origins are limited to:

- browser Supabase endpoint from `NEXT_PUBLIC_SUPABASE_URL`
- Cloudflare Turnstile `https://challenges.cloudflare.com` when configured

No application Realtime channel use was found, so no speculative WebSocket origin is approved.

Full details:

`docs/security/PHASE_9D_TELEMETRY_AND_CSP.md`

## Alert truth

Vercel automated alert state: NOT CLAIMED.

Documented responder thresholds:

- `worker.authentication_rejected`: >=10 in 5 minutes
- `worker.request_failed`: >=3 in 5 minutes or sustained after deployment
- `worker.rate_limited`: >=20 in 10 minutes per route/deployment context
- `security.control_misconfigured`: any production occurrence actionable

These remain operational contracts until an alert mutation surface is used and directly verified.

## Provider/runtime truth

Still true:

- production Turnstile enforcement: NOT CLAIMED
- Supabase leaked-password protection: NOT ENABLED
- Vercel project WAF custom rules: NOT CLAIMED
- CSP: NOT ENFORCED
- automated Vercel alerts: NOT CLAIMED

Keep false/absent:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Remaining Phase 9D gates

1. verify this checkpoint itself has zero GitHub Actions runs and an exact-head READY Preview
2. issue one harmless unauthenticated POST to the exact checkpoint Preview `/api/internal/workers/claim`
3. require bounded 401 response
4. inspect exact-deployment Vercel Runtime Logs and prove one `scopeforge.security.v1` `worker.authentication_rejected` event with only allowlisted fields
5. record runtime acceptance evidence
6. refresh `main` and reconcile any late UI overlap
7. freeze a tree-identical release candidate
8. require exact-candidate Preview READY
9. open/review PR against actual current `main`
10. run one substantive candidate CI and require all permanent gates success
11. squash merge only the exact verified head
12. independently verify post-merge main CI and exact production deployment
13. write a docs-only Phase 9D release checkpoint and Phase 9E handoff
