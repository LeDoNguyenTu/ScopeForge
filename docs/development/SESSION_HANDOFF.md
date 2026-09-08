# ScopeForge Session Handoff

Last refreshed: 2026-09-08 (Asia/Singapore)

Use this as the fastest resume point for ScopeForge hardening.

## Hard execution rules

- production `main` is the authoritative UI + backend baseline
- preflight before CI; do not use GitHub Actions as the debugging loop
- use `[skip ci]` for intermediate/docs-only checkpoints where Actions adds no executable evidence
- reserve substantive CI for frozen release candidates
- never rewrite deployed Supabase migrations; corrections are forward-only
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim a test/build/audit/security/deployment gate without exact evidence
- do not enable hosted worker/runtime capabilities as part of Phase 9 hardening
- leave PR #49 and its legacy UI branch untouched unless separately requested

## Current production baseline

Released `main`:

`0869767401011cd32dcd3e3b2976201461655e02`

Released tree:

`ca68a0559af93fc3b2143fdec387b84e418bb141`

Post-merge main CI:

- #771
- run `34227543168`
- success
- npm audit, full tests, typecheck, CLI build/version, historical benchmark, Phase 8B matrix, and production Next.js build all passed

Exact production deployment:

`dpl_CGFqqSx8qC1PVd6hRT6KT5WtQQ1N`

- exact Git SHA `0869767401011cd32dcd3e3b2976201461655e02`
- target production
- READY
- includes `scopeforge.dev`
- `aliasError=null`

This release sits directly on top of the finished production UI baseline `86d342216cf05d2951fd9ed427d35b6d575e7765`. Do not restore older UI assumptions.

## Latest security release - Phase 9C

Phase 9C database/RPC defense-in-depth is complete and released.

- PR #59
- frozen candidate `421dcb3b1a7a6243fdaac546f362653937254878`
- candidate tree `780be0767723abdaf4b7f67012050c836f15d736`
- candidate Vercel Preview `dpl_HMm9qAXPTBpi1HKPTWxDbtYgTja6` READY
- candidate CI #770 success
- squash merge `0869767401011cd32dcd3e3b2976201461655e02`
- main CI #771 success
- production deployment `dpl_CGFqqSx8qC1PVd6hRT6KT5WtQQ1N` READY

Dedicated release state:

`docs/development/PHASE_9C_RELEASE_STATE.md`

Live ScopeForge Supabase migration history includes:

`20260908084554_phase_9c_function_acl_hardening`

Do not rewrite `supabase/migrations/20260908170000_phase_9c_function_acl_hardening.sql`.

Live Phase 9C guarantees:

- 17 reviewed trigger-only private functions no longer expose direct execution to broad application roles
- `private.is_workspace_member` and `private.has_workspace_role` remain authenticated-only RLS helpers
- private worker tables remain inaccessible to `anon`/`authenticated`
- privileged public worker/control RPCs remain inaccessible to browser roles
- target triggers and pinned `SECURITY DEFINER` search paths remain intact
- repository tests require explicit ACL revocation for future application-function migrations

Do not apply a global `postgres` default-function revoke. It was rejected after live blast-radius analysis showed `postgres` also owns managed extension functions.

## Immediate resume action - Phase 9B

Start from the latest `main`, not the historical Phase 9A branch and not PR #49.

Phase 9B provider/edge abuse controls are next.

Current provider/UI facts:

- Supabase Security Advisor still reports `auth_leaked_password_protection`
- production AuthForm has no Turnstile yet
- production AuthForm already uses Phase 9A normalized errors
- current AuthForm styling/classes should be preserved
- Supabase native Auth rate limiting should remain primary for auth endpoints
- Vercel WAF/rate-limit state must be inspected before any claim or mutation

Phase 9B implementation priorities:

1. inspect live Supabase Auth config/rate limits and available config-write capabilities
2. enable leaked-password protection if supported with rollback evidence
3. implement Turnstile in the current sign-in/sign-up UI without redesigning it
4. configure provider secret/site-key boundaries safely
5. inspect/apply Vercel WAF/rate-limit controls only through supported surfaces
6. keep worker/control endpoints out of generic interactive challenge rules
7. add regression tests first
8. preview, freeze, CI, merge, production-verify, and record the release

If production provider configuration cannot be mutated through the connected surface, complete all code/config work that can be safely shipped, document the exact remaining operational gate, and never claim it was enabled.

## Then Phase 9D

- durable security-significant events through existing `audit_events`
- privacy-reduced structured operational security logs
- sensitive metadata/value protection and tests
- alerts/rollback signals
- preserve current header baseline
- stage CSP only with current UI/WebGL compatibility proof

## Then Phase 9E

Complete vulnerability disclosure, incident handling, credential rotation, rollback, recovery validation, and final release-security/public-launch procedures.

## Hosted runtime flags

Keep all four false/absent until their independent operational acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Legacy UI branch

PR #49 remains open/draft but is no longer the production hardening baseline. Do not merge, rebase, retarget, or modify it from Phase 9 work.
