# ScopeForge Session Handoff

Last refreshed: 2026-09-09 (Asia/Singapore)

Use this as the fastest resume point for ScopeForge Phase 9 hardening.

## Hard execution rules

- production `main` is always the authoritative integration baseline
- before freezing or merging a Phase 9 branch, re-read `main` and resolve any UI-stream drift first
- preserve the newest production UI when resolving overlaps; reapply only the reviewed security change
- preflight before CI; do not use GitHub Actions as a debugging loop
- use `[skip ci]` for intermediate and docs-only commits
- reserve substantive CI for frozen release candidates
- never rewrite deployed Supabase migrations
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim tests, provider state, WAF state, or production enforcement without exact evidence
- do not enable hosted worker/runtime capability flags as part of Phase 9 hardening
- PR #49 remains a legacy draft UI branch and is not the hardening baseline

## Current released production baseline

Executable release:

`f203168e6ae25455743849f08511e371d3964153`

Tree:

`9980aa5a58014998fd26ae7084bd97c992bc1a82`

Exact production evidence:

- PR #60 squash merge `f203168e6ae25455743849f08511e371d3964153`
- post-merge main CI #774, run `34236559722`, success
- production deployment `dpl_AM7VULiVFxKW1imXGiWpfs4Sx62z`
- deployment Git SHA exactly `f203168e6ae25455743849f08511e371d3964153`
- target production
- READY
- `scopeforge.dev` alias present
- `aliasError=null`

This tree contains the current production UI plus released Phase 9A, 9B, and 9C hardening.

## Released Phase 9B

Dedicated state:

`docs/development/PHASE_9B_RELEASE_STATE.md`

Release identity:

- frozen candidate `3d9d3c3aef3faef8f6706c53673fb0fcaad802bb`
- frozen tree `9980aa5a58014998fd26ae7084bd97c992bc1a82`
- preview `dpl_FcFdrKhr31kgQHWjS723yZ4D49AT`, READY, `aliasError=null`
- candidate CI #773, run `34236014666`, success
- squash merge `f203168e6ae25455743849f08511e371d3964153`
- post-merge CI #774, success
- production `dpl_AM7VULiVFxKW1imXGiWpfs4Sx62z`, READY

Released code:

- dependency-free Cloudflare Turnstile explicit-render wrapper
- optional public key boundary `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- absent/blank key preserves existing auth behavior
- configured challenge gates submit until a token exists
- CAPTCHA tokens are forwarded directly to Supabase Auth and kept only in React memory
- failed/non-redirecting configured attempts invalidate/remount the challenge
- expiry/provider errors clear the token
- widget cleanup is explicit
- narrow auth cards use compact sizing
- Phase 9A bounded error behavior remains intact

No dependency, database, hosted-runtime, dashboard, landing, CSP, or telemetry executable file changed in Phase 9B.

## UI/merge-conflict result

The user required all concurrent UI drift to be reconciled before release.

Before freeze and merge, `main` was repeatedly refreshed. PR #60 remained `mergeable=true`, and its executable auth file set was disjoint from the current production landing/dashboard changes. No actual conflict surfaced, so no artificial reconciliation commit was needed.

The final merge was pinned to expected head `3d9d3c3aef3faef8f6706c53673fb0fcaad802bb`, and the squash merge preserved the candidate tree exactly.

For all future Phase 9 work, repeat the same rule: newest `main` UI wins, then reapply only the reviewed security delta if a true overlap appears.

## Live provider truth

Fresh Supabase Security Advisor reports exactly:

`auth_leaked_password_protection`

Therefore:

- leaked-password protection is NOT enabled
- production Turnstile enforcement is NOT claimed until provider/site-key configuration is directly verified
- Vercel project-specific WAF custom rules are NOT claimed as active without inspected evidence
- Supabase native Auth rate limiting remains in place

Provider activation/rollback guidance:

`docs/security/PHASE_9B_PROVIDER_CONTROLS.md`

Do not treat code capability as proof of active provider enforcement.

## Released Phase 9C

Dedicated state:

`docs/development/PHASE_9C_RELEASE_STATE.md`

Live migration history includes:

`20260908084554_phase_9c_function_acl_hardening`

Do not rewrite that migration or apply a global `postgres` default-function revoke.

## Next task - Phase 9D

Phase 9D security telemetry/browser hardening is next.

Approved direction:

- reuse `audit_events` and `lib/audit/write-audit-event.ts` for durable security-significant events
- use privacy-reduced structured server logs for high-frequency operational security signals
- never log secrets, credentials, cookies, authorization headers, worker lease tokens, source content, or raw executor output
- add metadata-safety/event-shape tests before implementation
- define alert/rollback signals using real available platform evidence
- preserve the existing browser-header baseline
- treat CSP as a separate compatibility gate against the exact current Next.js/WebGL production UI
- do not ship broad `unsafe-inline` merely to claim CSP
- do not touch PR #49

Before touching Phase 9D code, re-read the current audit writer/schema, logging paths, middleware, security-relevant routes, `next.config.ts`, and current production `main`; then complete the detailed Phase 9D design/plan workflow.

## Then Phase 9E

Complete disclosure, incident response, credential rotation, rollback, impact assessment, recovery validation, and final public-launch security procedures.

## Hosted runtime flags

Keep all four false/absent until their independent operational acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`
