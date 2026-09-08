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
- do not claim tests, provider state, WAF state, alerts, CSP, or production enforcement without exact evidence
- do not enable hosted worker/runtime capability flags as part of Phase 9 hardening
- PR #49 remains an open legacy draft UI branch and is not the Phase 9D hardening baseline

## Current released production baseline

Production docs baseline:

`2af9a92b68c224d290a9597ff1907e5f1098791e`

Executable release beneath it:

`f203168e6ae25455743849f08511e371d3964153`

Executable tree:

`9980aa5a58014998fd26ae7084bd97c992bc1a82`

Production release evidence remains recorded in the Phase 9B/9C release state files. The production UI on current `main` is authoritative.

## Active Phase 9D branch

Branch:

`feat/phase-9d-security-telemetry-browser-hardening-v1`

Approved spec:

`docs/superpowers/specs/2026-09-09-phase-9d-security-telemetry-browser-hardening-design.md`

Implementation plan:

`docs/superpowers/plans/2026-09-09-phase-9d-security-telemetry-browser-hardening.md`

Detailed implementation checkpoint:

`docs/development/PHASE_9D_WORKING_STATE.md`

Operational/CSP evidence:

`docs/security/PHASE_9D_TELEMETRY_AND_CSP.md`

## What Phase 9D has implemented

- closed `scopeforge.security.v1` server telemetry schema
- bounded allowlisted JSON events, maximum 1024 UTF-8 bytes
- warning/error transport through Vercel-captured server console output
- centralized worker HTTP classification for authentication rejection, access rejection, active-limit rate limiting, and unexpected 500 failures
- fixed compile-time route IDs on all seven internal worker endpoints
- no telemetry for ordinary 400/409 protocol/state conflicts by default
- no request objects, headers, cookies, bodies, IDs, credentials, lease tokens, source, raw executor output, or raw exception messages in the telemetry contract
- recursive audit metadata hardening while preserving the existing 8 KiB audit metadata ceiling
- regression coverage for the existing browser security-header baseline
- evidence-based CSP inventory and rollback/alert contracts

No database migration, package dependency, RLS/provider/WAF mutation, UI rewrite, `app/layout.tsx` change, CSP enforcement, or hosted-runtime activation is part of this Phase 9D implementation.

## Current exact build evidence

Implementation/evidence head:

`dfcd0403d84a01e2833d971e549323a03b67c094`

Tree:

`35d0307799fe964c5e33447ee987ba7809f4254c`

Exact Preview:

- deployment `dpl_8xMam5rVMmJnYQFMAgxpad2PB1A2`
- URL `https://scopeforge-flzp766z2-itsbrian.vercel.app`
- state READY
- `aliasError=null`
- Next.js production compile passed
- TypeScript validity check passed
- 10/10 static pages generated

This proves build/type compatibility, not the new Vitest contracts. There is no local repository checkout in the current harness, and intermediate GitHub Actions were intentionally suppressed. Full executable proof belongs to the frozen candidate CI.

## Cleanup note

A temporary placeholder file `docs/development/PHASE_9_WORKING_STATE.tmp` was accidentally introduced during checkpoint editing. It had no executable content and was explicitly deleted in commit:

`fc7a32bf2592236527fb5540ad546f9096b690ba`

Do not recreate it.

## CSP and provider truth

CSP: NOT ENFORCED.

The current UI still contains legitimate React inline style attributes, and Next.js framework bootstrap/hydration needs exact nonce/hash compatibility work. Do not add broad permanent `unsafe-inline` or `unsafe-eval` simply to make a policy pass.

Current provider claims remain conservative:

- production Turnstile enforcement: NOT CLAIMED
- Supabase leaked-password protection: NOT ENABLED
- Vercel project-specific WAF custom rules: NOT CLAIMED
- Vercel automated alerts: NOT CLAIMED

The current source inventory requires only the configured Supabase HTTPS origin and `https://challenges.cloudflare.com` when Turnstile is configured. No application Supabase Realtime channel use was found.

## Immediate next actions

1. wait for the exact-head Preview created by the final checkpoint commits and require READY
2. issue one harmless unauthenticated POST to `/api/internal/workers/claim` on that exact Preview
3. require the existing bounded 401 worker authentication response
4. inspect exact-deployment Vercel Runtime Logs for one `scopeforge.security.v1` `worker.authentication_rejected` event
5. verify the event contains only schema/event/severity/route/code/status and no secret or request-derived payload
6. record the runtime acceptance evidence
7. refresh current `main` and preserve newer UI if any overlap appears
8. freeze a tree-identical candidate
9. open/review the Phase 9D PR against actual current `main`
10. run the one substantive candidate GitHub Actions gate and require full success
11. squash merge only the verified candidate
12. independently verify main CI and the exact production deployment
13. write the Phase 9D release state and move the handoff to Phase 9E

## Hosted runtime flags

Keep all four false/absent until their independent operational acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`
