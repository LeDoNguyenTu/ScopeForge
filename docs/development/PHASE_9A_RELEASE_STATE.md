# ScopeForge Phase 9A Release State

Release date: 2026-09-08 (Asia/Singapore)

Status: released and independently verified

## Purpose

Phase 9A hardens the authentication boundary without changing Supabase provider configuration, database privileges, Dashboard V5, or hosted worker authority.

## Released scope

Phase 9A added:

- a shared local-only parser for post-auth return paths
- same-origin enforcement for `/auth/callback`
- same-origin enforcement for `/auth/confirm`
- rejection of unsafe external/ambiguous return targets
- bounded browser-visible authentication errors
- bounded rate-limit retry guidance
- focused behavior, route, component, and architecture regression coverage

Unsafe return targets include:

- absolute external URLs
- protocol-relative URLs
- backslash host-confusion forms
- encoded backslashes
- control characters
- malformed percent encoding
- decoded unsafe host-confusion forms

Unsafe targets fall back to `/dashboard`. Valid local paths retain safe query strings and fragments.

## Candidate identity

- PR: #58, `Phase 9A authentication boundary hardening`
- final candidate head: `386308657bca0d8ba66f86074992d9983db600ba`
- final candidate tree: `6c62f5223269597171bdb5caa39f647b4106a03f`
- base at validation: `d4f37b85738fc08ba3483bf98bb0e5e900184449`

The frozen candidate was tree-identical to the reviewed branch state.

## Candidate verification

Exact-head Vercel Preview:

- deployment: `dpl_8KXQU6NguYtVPLv42EwKK7eEoyPP`
- state: READY
- `aliasError=null`
- Next.js compile: success
- TypeScript validity check: success
- static generation: 9/9 pages

Final PR CI:

- run: #767
- GitHub Actions run ID: `34154800973`
- conclusion: success
- npm install: success
- npm audit: success
- full Vitest suite: success
- typecheck: success
- CLI build: success
- CLI version smoke: success
- historical scanner benchmark: success
- Phase 8B performance matrix: success
- production Next.js build: success

No review submissions or unresolved inline review threads existed at merge time.

## Merge identity

PR #58 was squash-merged with the expected candidate head SHA pinned.

- merge commit: `5c08003c8bf8cb920832431a346c9254aae92239`
- merge tree: `6c62f5223269597171bdb5caa39f647b4106a03f`
- direct parent: `d4f37b85738fc08ba3483bf98bb0e5e900184449`

The merge tree exactly matches the verified candidate tree.

## Post-merge verification

Main CI:

- run: #768
- GitHub Actions run ID: `34155136804`
- exact SHA: `5c08003c8bf8cb920832431a346c9254aae92239`
- conclusion: success
- npm audit: success
- full test suite: success
- typecheck: success
- CLI build/version: success
- historical scanner benchmark: success
- Phase 8B performance matrix: success
- production Next.js build: success

Production deployment:

- deployment: `dpl_BePDHoKDzWPXU6L2PX3Rj8bpTTue`
- target: `production`
- state: READY
- Git SHA: `5c08003c8bf8cb920832431a346c9254aae92239`
- `aliasError=null`
- aliases include `scopeforge.dev`

## Authority and configuration boundaries

Phase 9A did not change:

- Supabase Auth provider settings
- Supabase leaked-password protection
- Supabase Auth rate-limit configuration
- Supabase schemas, grants, RLS policies, or migrations
- Cloudflare Turnstile
- Vercel WAF/rate-limit rules
- CSP
- Dashboard V5 / PR #49
- hosted worker/runtime authority

Keep false/absent unless separately authorized:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

## Supabase advisor state after Phase 9A

The live ScopeForge project `tdgpibrepzcvdivztkta` still reports one security warning:

- `auth_leaked_password_protection` - leaked password protection is disabled

This warning is intentionally not claimed as resolved by Phase 9A. Provider-level remediation remains a later reviewed Phase 9 boundary.

## Next boundary

Phase 9C database/RPC defense-in-depth is next.

Start with live privilege inventory and executable regression evidence before proposing DDL. Preserve the current RLS dependency on required private helper functions, and use only forward-only migrations for justified privilege reductions.

Phase 9B Turnstile/WAF/provider controls remain separate and require their own operational acceptance.
