# ScopeForge Session Handoff

Last refreshed: 2026-09-08 (Asia/Singapore)

This is the fastest entry point for the current non-UI stream.

## Hard execution rules

- preflight before CI; do not use GitHub Actions as the first debugging loop
- use `[skip ci]` for intermediate/docs-only checkpoints where Actions adds no executable evidence
- reserve substantive CI for frozen executable/release candidates
- do not modify, merge, retarget, replace, or deploy the active Dashboard V5/UI stream from this workstream
- do not enable hosted worker/runtime capabilities as part of a code merge
- do not rewrite deployed Supabase migrations; corrections are forward-only
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim a test/build/audit/security gate without evidence tied to the relevant SHA

## Current completed release - Phase 8C

Phase 8C reproducible technical publication is complete, merged, CI-verified, and production-verified.

- merged PR: #57
- final verified PR head: `1964d2b581d61190eb95a82e34f233aa36a5ee2a`
- verified tree: `68a8e502b40594778776d1fb627e6cf806158dca`
- final PR CI #764: success
- squash merge on `main`: `a8feb63a8ca00dcbbc52b0eb32c6880cb38670d1`
- post-merge main CI #765: success
- npm audit gate passed
- full test suite passed
- typecheck and CLI build/version passed
- historical benchmark and Phase 8B matrix passed
- production Next.js build passed
- production deployment: `dpl_HFrLZmrPAhFPYvq8SDCJQRYDjJpe`
- production deployment target: `production`
- production deployment state: READY
- production deployment Git SHA: `a8feb63a8ca00dcbbc52b0eb32c6880cb38670d1`

The first release candidate CI #763 failed only because the new workflow-order regression test searched for `npm run build` and matched the earlier `npm run build:cli` step. The assertion was corrected to match the exact production-build workflow line, the repaired tree reached Vercel READY, and replacement candidate CI #764 passed every gate. Do not treat #763 as a product or publication-runtime defect.

## Released Phase 8 publication

Committed machine-readable source of truth:

`validation/publication/phase-8-release-v1.evidence.json`

Human-readable report:

`docs/validation/reports/phase-8-release-v1.md`

Publication methodology:

`docs/validation/PUBLICATION.md`

The release preserves exact Phase 8A/8B provenance, raw accuracy counts, all accepted benchmark runs, deterministic summaries, limitations, unsupported scenarios, privacy reductions, and explicit claim boundaries.

The 32-case corpus is not global or real-world accuracy. Catastrophic benchmark ceilings are not product SLOs. RSS delta is not peak-memory measurement.

## Current resume action - Phase 9A auth boundary

Phase 9 has started on isolated branch `feat/phase-9-security-hardening-v1` from released main `d4f37b85738fc08ba3483bf98bb0e5e900184449`.

Authoritative in-progress state:

`docs/development/PHASE_9_WORKING_STATE.md`

Phase 9 design:

`docs/superpowers/specs/2026-09-08-phase-9-security-hardening-design.md`

Phase 9A implementation plan:

`docs/superpowers/plans/2026-09-08-phase-9a-auth-boundary.md`

Current executable/test checkpoint:

`0fb9db1a72e4bb66bc049594fbee2c47a5b7a038`

Current branch checkpoint after working-state docs:

`2577efa0176629a53e1eadbd145f8a52bf54f1c6`

Implemented Phase 9A controls:

- one shared local-only auth return-path parser
- same-origin success redirects for `/auth/callback` and `/auth/confirm`
- rejection of absolute URLs, protocol-relative URLs, backslash confusion, control characters, malformed encodings, and decoded external-host forms
- bounded browser-visible sign-in/sign-up failures
- bounded retry guidance for rate-limit errors
- regression tests and static architecture guards

Exact executable/test head `0fb9db1...` has Vercel Preview `dpl_C14uBw9rw2N8XLRGMMNqKFHYM5v1` READY with `aliasError=null`, successful Next.js compilation, TypeScript validity checking, and 9/9 static generation.

Final GitHub Actions execution has not yet been run. Do not claim Phase 9A release completion until the frozen candidate passes the focused/full test suite, typecheck, CLI build/version, audit, historical benchmark, Phase 8B matrix, and production build.

The local harness has no repository checkout and cannot resolve github.com, so test-first commit ordering was preserved without consuming Actions for RED runs. Substantive test execution is reserved for the frozen candidate.

## Phase 9 operational controls not changed yet

Do not infer Phase 9A code implementation enabled production hardening controls.

Still unchanged/pending:

- Supabase leaked-password protection
- Supabase Auth rate-limit configuration
- Turnstile
- Vercel WAF/rate-limit rules
- private-schema/function privilege changes
- CSP
- security telemetry/alerts
- incident/release hardening

The live Supabase Security Advisor warning `auth_leaked_password_protection` remains a later Phase 9 acceptance item.

## Next non-UI boundary after Phase 9A

After Phase 9A is frozen, CI-verified, and merged, continue with Phase 9C database/RPC defense-in-depth.

Begin Phase 9C with privilege inventory and regression evidence before proposing any forward-only migration. Do not blindly revoke `authenticated` schema usage because current RLS policies intentionally call private helper functions.

Phase 9B provider-level Turnstile/WAF changes remain later and require their own operational acceptance.

## Separate operational queues

Production enablement for Phase 6B acquisition, 6C isolated scanning, and 6D passive/active runtime workers remains separately gated. All four hosted capability flags stay false/absent until their own acceptance/canary/rollback gates complete.

## UI isolation

PR #49 and all active Dashboard V5/UI branches remain independent. Do not edit, merge, replace, retarget, or deploy them from the Phase 9 non-UI stream.

## Cleanup

Merged backend refs may remain if the connected GitHub write surface has no genuine branch delete-ref operation. Do not force-move a branch to simulate deletion. Preserve PR #49 and all active V5/UI branches.
