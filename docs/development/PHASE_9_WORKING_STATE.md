# ScopeForge Phase 9 Working State

Last reconciled: 2026-09-09 (Asia/Singapore)

## Phase status

- Phase 9 architecture: approved
- Phase 9A authentication boundary: complete and released
- Phase 9B provider/auth hardening code: complete and released; external provider activation remains pending verification
- Phase 9C database/RPC defense-in-depth: complete and released
- Phase 9D security telemetry/browser hardening: next implementation boundary
- Phase 9E incident/release hardening: pending after 9D

## Authoritative production baseline

Current production executable release:

`f203168e6ae25455743849f08511e371d3964153`

Current production tree:

`9980aa5a58014998fd26ae7084bd97c992bc1a82`

Release evidence:

- PR #60 squash merge `f203168e6ae25455743849f08511e371d3964153`
- frozen candidate `3d9d3c3aef3faef8f6706c53673fb0fcaad802bb`
- candidate tree `9980aa5a58014998fd26ae7084bd97c992bc1a82`
- candidate CI #773, run `34236014666`, success
- post-merge main CI #774, run `34236559722`, success
- exact production deployment `dpl_AM7VULiVFxKW1imXGiWpfs4Sx62z`, READY
- deployment Git SHA exactly `f203168e6ae25455743849f08511e371d3964153`
- production alias includes `scopeforge.dev`
- `aliasError=null`

The current production UI is authoritative. PR #49 remains an open draft legacy UI branch and is out of scope.

## Phase 9B release

Dedicated release state:

`docs/development/PHASE_9B_RELEASE_STATE.md`

Released behavior:

- dependency-free Cloudflare Turnstile wrapper using explicit rendering
- public configuration boundary is `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- absent/blank site key preserves existing auth behavior
- configured challenge disables submit until a token exists
- sign-in forwards `options.captchaToken`
- sign-up preserves display metadata and forwards `captchaToken`
- token stays in React component memory
- failed/non-redirecting configured attempts invalidate the token and remount the challenge
- expiry/provider errors clear the token
- cleanup removes the widget
- narrow auth cards use compact sizing; wider cards use flexible sizing
- Phase 9A bounded auth errors remain intact

No package dependency, database/RLS/function ACL, hosted runtime, dashboard, landing, CSP, or telemetry change was part of the Phase 9B executable release.

## Phase 9B merge/UI reconciliation result

The user required concurrent UI changes to be preserved.

The exact current `main` SHA was re-read before freeze, before CI release, and immediately before merge. PR #60 remained `mergeable=true`; the Phase 9B executable file set was disjoint from the current production landing/dashboard changes. No real Git conflict surfaced, so no synthetic reconciliation commit was created.

The merge operation pinned expected head `3d9d3c3aef3faef8f6706c53673fb0fcaad802bb`. GitHub accepted the merge against the unchanged CI-tested base, and the squash merge preserved the frozen candidate tree exactly.

For future phases, continue to re-read `main` before freeze/merge and preserve the newest production UI whenever overlaps appear.

## Live provider truth

Fresh ScopeForge Supabase Security Advisor after release reports exactly one warning:

`auth_leaked_password_protection`

Claims that remain intentionally NOT made:

- leaked-password protection is not enabled
- production Turnstile enforcement is not claimed until external provider/site-key configuration is directly verified
- Vercel project-specific WAF custom-rule enforcement is not claimed without direct evidence

Supabase native Auth rate limiting remains the primary auth-endpoint limiter.

Activation and rollback guidance remains in `docs/security/PHASE_9B_PROVIDER_CONTROLS.md`.

## Phase 9C release

Dedicated release state:

`docs/development/PHASE_9C_RELEASE_STATE.md`

Do not rewrite the deployed Phase 9C migration and do not apply a global `postgres` default-function revoke.

## Phase 9D direction

Phase 9D is next.

Reuse existing durable audit infrastructure for security-significant events and privacy-reduced structured server logs for high-frequency operational signals.

Design constraints:

- passwords, tokens, API keys, credentials, cookies, authorization headers, worker lease tokens, source content, and raw executor output must never enter security telemetry
- durable audit storage is for significant security/account/workspace events, not high-volume request telemetry
- structured server logs must use bounded allowlisted fields and privacy-reduced values
- preserve the existing security-header baseline unless a reviewed change is justified
- stage CSP only after compatibility proof with the exact current production Next.js/WebGL UI
- do not use broad `unsafe-inline` merely to claim CSP coverage
- do not couple telemetry to visual components
- do not touch PR #49

Before implementation, re-read the current audit writer/schema, logging paths, middleware, `next.config.ts`, and security-relevant routes, then complete the detailed Phase 9D design/plan workflow.

## Phase 9E direction

Complete vulnerability disclosure, incident response, credential rotation, rollback, impact assessment, recovery validation, and final public-launch security procedures.

## Runtime authority boundary

Keep false/absent unless separately authorized by their own operational gates:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`
