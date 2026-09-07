# ScopeForge Phase 9 Working State

Last reconciled: 2026-09-08 (Asia/Singapore)

## Current Phase 9 status

- Phase 9 design: approved and committed
- Phase 9A authentication boundary: complete and released
- Phase 9B provider/edge abuse controls: pending separate operational acceptance
- Phase 9C database/RPC defense-in-depth: next implementation boundary
- Phase 9D telemetry/browser hardening: pending
- Phase 9E incident/release hardening: pending

Dashboard V5/UI PR #49 remains a separate workstream and has not been modified by Phase 9.

## Phase 9A released state

Released main:

- commit: `5c08003c8bf8cb920832431a346c9254aae92239`
- tree: `6c62f5223269597171bdb5caa39f647b4106a03f`
- PR: #58
- final PR head: `386308657bca0d8ba66f86074992d9983db600ba`
- PR CI #767: success
- post-merge main CI #768: success
- exact production deployment: `dpl_BePDHoKDzWPXU6L2PX3Rj8bpTTue`, READY, `aliasError=null`

Released behavior:

- safe local-only post-auth return paths
- same-origin auth callback/confirmation redirects
- bounded browser-visible auth failures
- bounded rate-limit retry guidance
- regression tests and architecture guards

Phase 9A made no Supabase project setting, schema, grant, WAF, Turnstile, CSP, or worker-authority change.

## Phase 9C starting boundary

Phase 9C must begin evidence-first.

Required initial evidence:

1. live public/private schema grants
2. table RLS and ordinary-client table privileges
3. function ACLs and callable roles
4. trigger-vs-callable function classification
5. `SECURITY DEFINER` and fixed `search_path` status
6. exact RLS dependencies on private helper functions
7. current migration-history intent for those grants

Known live facts from the Phase 9 design pass:

- all exposed `public` tables have RLS enabled
- private worker tables have no direct ordinary-client table grants
- `authenticated` has `USAGE` on schema `private`
- public RLS policies intentionally depend on `private.is_workspace_member` and `private.has_workspace_role`
- critical worker-control RPCs are restricted to service-role execution
- many private trigger/helper functions appear to retain default `PUBLIC EXECUTE`, which requires exact classification before any revocation proposal

Do not blindly revoke `USAGE ON SCHEMA private FROM authenticated`.

Do not assume every `PUBLIC EXECUTE` grant is exploitable merely because it exists. Determine whether the function is trigger-only, directly callable, privilege-defining, and dependent on caller context before changing ACLs.

Any justified privilege reduction must use a new forward-only migration. Never rewrite deployed migration history.

## Phase 9C acceptance shape

Before a Phase 9C merge candidate is considered safe, require at least:

- focused database/RPC privilege regression tests
- exact live privilege queries before and after any DDL change
- proof ordinary clients cannot read private worker state
- proof ordinary clients cannot execute worker-control RPCs
- preserved RLS behavior for valid workspace members/admins/owners
- Supabase Security Advisor after DDL
- generated TypeScript types if schema-visible signatures change
- full test suite
- typecheck
- CLI build/version
- historical and matrix benchmarks
- npm audit
- production Next.js build
- exact-head Vercel Preview READY
- one frozen GitHub Actions candidate
- exact base/head review before merge
- post-merge main CI and production deployment verification

## Pending provider hardening

Live Supabase Security Advisor currently still reports:

- `auth_leaked_password_protection`

That belongs to the separate provider-hardening acceptance stream. Do not silently mix it into Phase 9C database privilege work unless a reviewed dependency makes that necessary.

## Runtime authority boundary

Keep false/absent unless separately authorized:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Phase 9 hardening does not itself authorize hosted execution.
