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

## Latest completed release - Phase 9A

Phase 9A authentication-boundary hardening is complete, merged, CI-verified, and production-verified.

- merged PR: #58
- final verified PR head: `386308657bca0d8ba66f86074992d9983db600ba`
- verified tree: `6c62f5223269597171bdb5caa39f647b4106a03f`
- final PR CI #767: success
- squash merge on `main`: `5c08003c8bf8cb920832431a346c9254aae92239`
- post-merge main CI #768: success
- exact production deployment: `dpl_BePDHoKDzWPXU6L2PX3Rj8bpTTue`
- deployment: READY, target `production`, `aliasError=null`, includes `scopeforge.dev`

Released controls:

- local-only validation for post-auth `next` navigation
- same-origin redirects from `/auth/callback` and `/auth/confirm`
- rejection of absolute, protocol-relative, backslash-confused, control-character, malformed-encoding, and decoded unsafe return targets
- bounded browser-visible sign-in/sign-up errors
- bounded authentication rate-limit retry guidance without raw provider detail
- focused and architecture regression tests

Phase 9A did not change Supabase Auth settings, database privileges, Turnstile, Vercel WAF, CSP, or worker/runtime authority.

Dedicated release state:

`docs/development/PHASE_9A_RELEASE_STATE.md`

## Phase 8 baseline remains authoritative

Phase 8C publication remains released and unchanged:

- merged PR #57
- release merge `a8feb63a8ca00dcbbc52b0eb32c6880cb38670d1`
- publication evidence `validation/publication/phase-8-release-v1.evidence.json`
- human report `docs/validation/reports/phase-8-release-v1.md`

The 32-case corpus is not global or real-world accuracy. Catastrophic benchmark ceilings are not product SLOs. RSS delta is not peak-memory measurement.

## Current resume action - Phase 9C database/RPC defense-in-depth

Phase 9C is the next non-UI implementation boundary.

Start from the released Phase 9A `main` baseline, including the docs-only checkpoint that follows it.

Begin with live read-only evidence and migration-history reconciliation before writing any DDL:

- enumerate schema/table grants and RLS state
- enumerate function ACLs, trigger functions, security-definer status, and search paths
- identify ordinary-user dependencies on `private.is_workspace_member` and `private.has_workspace_role`
- prove ordinary users cannot read private worker tables
- prove ordinary users cannot execute worker-control RPCs
- identify unnecessary `PUBLIC EXECUTE` privileges on private trigger/helper functions

Do not blindly revoke `authenticated` usage on schema `private`. Existing public RLS policies intentionally call private helper functions.

If privilege reduction is warranted, use a new forward-only migration only after exact callers and required grants are proven.

## Phase 9 provider controls still pending

The live Supabase Security Advisor still reports one warning:

- `auth_leaked_password_protection`

Do not describe this as fixed.

Turnstile, Auth rate-limit changes, Vercel WAF/rate-limit rules, telemetry/alerts, CSP, and incident/release hardening remain later reviewed boundaries.

## Separate operational queues

Production enablement for Phase 6B acquisition, 6C isolated scanning, and 6D passive/active runtime workers remains separately gated. All four hosted capability flags stay false/absent until their own acceptance/canary/rollback gates complete.

## UI isolation

PR #49 and all active Dashboard V5/UI branches remain independent. Do not edit, merge, replace, retarget, or deploy them from the Phase 9 non-UI stream.

## Cleanup

Merged backend refs may remain if the connected GitHub write surface has no genuine branch delete-ref operation. Do not force-move a branch to simulate deletion. Preserve PR #49 and all active V5/UI branches.
