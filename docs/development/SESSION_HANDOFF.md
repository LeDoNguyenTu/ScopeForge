# ScopeForge Session Handoff

Last refreshed: 2026-09-08 (Asia/Singapore)

This is the fastest entry point for the current non-UI stream.

## Hard execution rules

- preflight before CI; do not use GitHub Actions as the first debugging loop
- use `[skip ci]` for intermediate/docs-only checkpoints where Actions adds no executable evidence
- reserve substantive CI for frozen executable/release candidates
- do not modify, merge, retarget, replace, or deploy Dashboard V5/UI PR #49 or its branches from this workstream
- do not enable hosted worker/runtime capabilities as part of a hardening merge
- do not rewrite deployed Supabase migrations; corrections are forward-only
- never confuse ScopeForge Supabase `tdgpibrepzcvdivztkta` with another project
- do not add AI co-author attribution
- do not claim a test/build/audit/security gate without evidence tied to the relevant SHA or live database state

## Latest completed release - Phase 9A

Phase 9A authentication-boundary hardening is complete and independently verified.

- PR #58
- final PR head `386308657bca0d8ba66f86074992d9983db600ba`
- verified tree `6c62f5223269597171bdb5caa39f647b4106a03f`
- PR CI #767 success
- squash merge `5c08003c8bf8cb920832431a346c9254aae92239`
- main CI #768 success
- production deployment `dpl_BePDHoKDzWPXU6L2PX3Rj8bpTTue` READY on `scopeforge.dev`
- docs checkpoint `c4aaf76a08960d68159d9c96f053e38e7963a859`
- docs production deployment `dpl_7bZHFTnDfngH3bGwt5BqA7HG6j17` READY, `aliasError=null`

## Current work - Phase 9C database/RPC defense-in-depth

Branch:

`feat/phase-9c-database-rpc-hardening-v1`

Baseline:

`c4aaf76a08960d68159d9c96f053e38e7963a859`

Approved design head:

`780db1de7e1b79e64533851c9aa312730311bae3`

Implementation plan commit:

`55becf0ff9267634de2ce5212de992cee75cd7cd`

Test-only structural RED commit:

`72d5d75ecf5e16e775eaa95ed7ac9ddb083a95ef`

At that SHA the referenced Phase 9C migration path did not exist. No local checkout is available in this harness, so Vitest RED was not executed.

Migration commit:

`849109b14dc741d75c3d8f43983127de01bb90d4`

Architecture correction guard commit:

`906fd1e3313eac2769f4575dcd2111b69e82ff59`

Corrective design amendment:

`docs/superpowers/specs/2026-09-08-phase-9c-default-acl-amendment.md`

Corrective plan:

`docs/superpowers/plans/2026-09-08-phase-9c-default-acl-amendment.md`

### Live Supabase state

Project: `tdgpibrepzcvdivztkta`

Engine during preflight/canary: PostgreSQL `17.6`

Applied migration-history entry:

`20260908084554_phase_9c_function_acl_hardening`

Repository migration:

`supabase/migrations/20260908170000_phase_9c_function_acl_hardening.sql`

The migration has already been applied to the live ScopeForge project. Never rewrite that repository migration or attempt to replace its migration-history entry.

### Live canary

Before permanent DDL, a transaction-scoped private trigger canary proved an already-created trigger still fires when the DML role no longer has direct `EXECUTE` on the trigger function. The marker was asserted as `fired`, the transaction was rolled back, and catalog checks proved the canary table and function no longer existed.

### Live acceptance after migration

Current acceptance is clean:

- all 17 target trigger-only private functions: no direct execution for `PUBLIC`, `anon`, `authenticated`, or `service_role`
- both RLS helpers: authenticated execution preserved, other tested roles false
- `authenticated` schema `private` usage: preserved
- private worker table privilege violations for `anon`/`authenticated`: zero
- public privileged worker/control RPC violations for `anon`/`authenticated`: zero
- missing or disabled target trigger bindings: zero
- relevant `SECURITY DEFINER` search-path failures: zero
- real `authenticated` RLS transaction: workspace visibility true, membership helper true, role helper true

No identifying account/workspace data was returned from the RLS acceptance result.

### PostgreSQL default-ACL correction

Live acceptance exposed that schema-scoped default `REVOKE` cannot override PostgreSQL's hard-wired global `PUBLIC EXECUTE` for new functions.

Do not solve this with a global `ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... REVOKE ... FROM PUBLIC`. Live ownership inventory shows `postgres` also owns managed extension functions outside `public` and `private`, so a global owner default is too broad.

The authoritative corrective design is the repository migration guard:

- every migration after `20260908170000_phase_9c_function_acl_hardening.sql` that creates a `public` or `private` function must include an explicit same-migration function revoke
- intentionally callable functions then receive only their explicit narrow grant
- global `postgres` default revocation is rejected
- `supabase_admin` defaults stay untouched

The schema-local default ACL statements already present in the deployed migration are not release evidence for future function denial. Leave migration history immutable.

### Supabase Security Advisor

After DDL, exactly one warning remains:

`auth_leaked_password_protection`

This is pre-existing and belongs to the separate provider-hardening stream. Do not describe it as fixed by Phase 9C.

## Immediate resume steps

1. Complete the branch working checkpoint commit containing `PHASE_9_WORKING_STATE.md` and this handoff.
2. Compare branch against baseline and reject unrelated scope.
3. Verify exact-head Vercel Preview is READY.
4. Freeze one tree-identical release candidate.
5. Open the Phase 9C PR as draft first.
6. Verify candidate preview and PR metadata, then mark ready for the one substantive Actions run.
7. CI must execute and pass npm audit, full Vitest suite, typecheck, CLI build/version, historical benchmark, Phase 8B matrix, and production Next build.
8. Perform exact immutable pre-merge checks and squash-merge only the verified head.
9. Independently verify main CI and exact production deployment.
10. Write the docs-only Phase 9C release/handoff checkpoint.

Vitest for the new Phase 9C architecture test has not executed yet. Do not claim it is green until frozen CI proves it.

## Phase 9 provider controls still pending

- leaked-password protection
- Turnstile
- Auth rate-limit changes
- Vercel WAF/rate limits
- telemetry/alerts
- CSP
- incident/release hardening
- legacy table-grant cleanup on `profiles`, `workspaces`, and `workspace_members`

## Separate operational queues

Production enablement for Phase 6B acquisition, 6C isolated scanning, and 6D passive/active runtime workers remains separately gated. Keep all four hosted capability flags false/absent.

## UI isolation

PR #49 and all Dashboard V5/UI branches remain independent. Do not edit, merge, retarget, or deploy them from Phase 9C.
