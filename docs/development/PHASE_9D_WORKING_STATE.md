# ScopeForge Phase 9D Working State

Last reconciled: 2026-09-09 (Asia/Singapore)

## Status

Phase 9D implementation is complete through exact-head Preview build and pre-release review. The next commit containing this document is the frozen release-candidate trigger and intentionally omits `[skip ci]` so the permanent CI gate executes once on the reviewed tree.

Branch:

`feat/phase-9d-security-telemetry-browser-hardening-v1`

Production base:

`2af9a92b68c224d290a9597ff1907e5f1098791e`

Implementation/evidence head before the canonical documentation checkpoint:

`dfcd0403d84a01e2833d971e549323a03b67c094`

Tree:

`35d0307799fe964c5e33447ee987ba7809f4254c`

Canonical reviewed checkpoint before candidate freeze:

`d6a1631d2df0bb4afddc358c11890349c7973510`

## Exact Preview evidence

Implementation/evidence Preview:

- deployment `dpl_8xMam5rVMmJnYQFMAgxpad2PB1A2`
- URL `https://scopeforge-flzp766z2-itsbrian.vercel.app`
- Git SHA `dfcd0403d84a01e2833d971e549323a03b67c094`
- target preview
- state READY
- `aliasError=null`
- Next.js production compile succeeded
- TypeScript validity check succeeded
- 10/10 static pages generated

Canonical checkpoint Preview:

- deployment `dpl_2AP7FnpTAPSrdJDRhJGC9DsACJnw`
- URL `https://scopeforge-mkv90kmz6-itsbrian.vercel.app`
- Git SHA `d6a1631d2df0bb4afddc358c11890349c7973510`
- target preview
- state READY
- `aliasError=null`

These previews prove compile/type/build compatibility only. They do not prove the new Vitest contracts because this harness has no local executable repository checkout and intermediate GitHub Actions were deliberately suppressed.

## Scope from production base

The reviewed checkpoint is 27 commits ahead and 0 behind the production base.

Changed files are limited to:

- seven internal worker route files, each with one fixed telemetry route-id argument
- `lib/security/telemetry.ts`
- `lib/audit/write-audit-event.ts`
- `lib/worker-control/http-response.ts`
- focused security/worker/architecture tests
- Phase 9D spec and implementation plan
- Phase 9D security/working-state documentation
- canonical Phase 9 and session handoff documentation

No package file, database migration, RLS policy, Supabase provider setting, Vercel WAF setting, `app/layout.tsx`, landing/dashboard visual file, or hosted-runtime flag changed.

Current `main` was refreshed during preflight and remained exactly:

`2af9a92b68c224d290a9597ff1907e5f1098791e`

PR #61 is mergeable and has no submitted reviews or inline review threads at the freeze boundary. PR #49 remains untouched.

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

A pre-freeze compatibility review checked existing audit metadata keys used by runtime and active-validation flows, including `failureCode`, `requestCount`, `redirectCount`, `reasonCode`, `profileId`, `profileVersion`, `authorizationGrantedAt`, `assetKind`, `jobKind`, `findingCount`, and `status`. None are rejected by the hardened key policy.

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

Because this harness has no local executable repository checkout, focused RED/GREEN is structural rather than executed. The frozen GitHub Actions candidate is the first claimed executable proof for these new Vitest contracts.

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

## Runtime acceptance tooling limitation

The planned release gate includes one harmless unauthenticated POST to the exact Preview `/api/internal/workers/claim`, followed by inspection of that exact deployment's Runtime Logs for a bounded `worker.authentication_rejected` event.

This chat environment cannot currently execute that POST:

- the local container cannot resolve external DNS
- the connected Vercel fetch action is read-only/GET-oriented
- the browser-automation skill is documented but its executable browser resource is not loaded in this chat
- no installed HTTP/REST request plugin is available

Therefore the real Preview request/log observation remains explicitly NOT VERIFIED. The candidate CI must not be described as proving this separate runtime-observability gate.

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

## Frozen candidate gate

This documentation-only freeze commit intentionally changes no executable source. Its exact Git SHA and tree are captured from GitHub immediately after creation and become the only candidate identities accepted for this release attempt.

Required candidate evidence:

1. exact candidate Vercel Preview READY with `aliasError=null`
2. one substantive GitHub Actions `CI / validate` run on the exact PR integration candidate
3. `npm audit --audit-level=info` success
4. full Vitest suite success, including all new Phase 9D contracts
5. TypeScript typecheck success
6. CLI build/version success
7. historical scanner benchmark success
8. Phase 8B benchmark matrix success
9. production Next.js build success
10. refresh `main`, mergeability, review submissions, and review threads before integration
11. squash merge only with expected-head protection on the exact verified candidate
12. independently verify post-merge `main` CI and exact production deployment
13. keep the Preview POST/Runtime Log acceptance gate explicitly unresolved until directly observed
14. write a docs-only Phase 9D release/checkpoint record that does not overclaim unresolved evidence
