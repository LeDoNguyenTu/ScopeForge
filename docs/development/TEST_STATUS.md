# ScopeForge Test Status

## Phase 5C verification state

Phase 5C Hosted Phase 3 finding import is implemented on PR #37. GitHub Actions monthly allowance was exhausted during the PR, and the user explicitly requested no further GitHub Actions use for the remainder of the month. Subsequent commits use `[skip ci]`.

The final PR head must therefore **not** be described as exact-head CI green.

## Pre-quota executable checkpoints

Before the Actions allowance was exhausted, Phase 5C was developed through explicit RED/GREEN checkpoints.

- Task 3 database migration boundary passed CI #714 with 154 test files / 689 tests, strict typecheck, CLI build/version smoke, scanner benchmark, and Next.js production build.
- Task 4 trusted service/repository boundary passed CI #718 completely.
- CI #720 on the initial Task 5 route passed all 156 test files / 701 tests, strict typecheck, CLI build/version smoke, and scanner benchmark. The final Next.js build then correctly rejected an unsupported extra export from `app/api/phase3-import/route.ts`.
- That route-export issue was fixed by moving `PHASE3_IMPORT_MAX_BODY_BYTES` to `lib/phase3-import/transport.ts` so the route module exports only valid App Router fields.
- Later Actions jobs failed before checkout because the monthly allowance was exhausted, not because repository commands ran and failed.

After the quota boundary, additional review-driven hardening was committed with `[skip ci]` and verified through direct code review plus live platform contracts rather than GitHub Actions.

## Phase 5C regression coverage in the repository

### Hosted export and privacy

Coverage specifies:

- deterministic versioned hosted envelope
- canonical public GitHub repository URL
- repository-relative paths only
- no local absolute root
- no arbitrary scanner metadata
- no source snippets or data-flow details
- no scanner diagnostic text
- no SBOM body/artifact upload
- maximum 500 findings
- secret locations omit precise columns
- local secret-derived fingerprints are re-keyed before hosted export
- hosted secret fingerprint identity uses safe rule/version/path/line data only
- secret evidence summaries are regenerated from reviewed rule metadata rather than copied from scanner output

### Validation and source registry

Coverage specifies strict JSON keys, canonical timestamps/URLs/paths, bounded strings/counts, closed scanner descriptors, closed scanner/rule/version lookup, source/evidence provenance mapping, server-side canonicalization, and runRef recomputation.

### Database authority and idempotency

Coverage specifies:

- separate enum migration for `phase3_import`
- terminal succeeded repository import jobs only
- immutable `security_phase3_import_runs`
- RLS-protected SELECT-only browser access
- `SECURITY DEFINER` persistence RPC with empty search path
- execute privilege only for `service_role`
- independent actor membership/role validation
- exact workspace/repository binding
- 500 finding / 500 evidence bounds
- static/dependency evidence only
- exact retry idempotency and conflict rejection
- recurrence reopening rules
- no absence-based `verified_fixed`
- Phase 5C foreign-key covering indexes
- manual database type contract includes the new enum/table/RPC

### Service and route boundary

Coverage specifies viewer rejection, cross-workspace/repository mismatch rejection, server-derived authoritative rows, safe secret locations, idempotent replay, safe conflict mapping, authentication, JSON-only transport, 3.5 MB declared and streamed request limits, rejection of forged lifecycle/source fields, and no trusted persistence for unauthenticated/malformed requests.

### Repository UX and finding scaling

Coverage specifies repository-only import UI, exact CLI command, privacy disclosure, bounded import history, canonical findings navigation, no repository runtime/active execution, 100-row finding pagination with one-row lookahead, and deterministic `last_seen_at` plus `finding_id` ordering.

### Architecture guards

Repository tests forbid trusted Phase 5C modules from acquiring:

- runtime package authority
- scanner filesystem/inventory/coordinator execution
- Node child-process/filesystem/socket/network/HTTP/TLS/VM/worker authority
- direct fetch
- repository clone/checkout
- package-manager installation
- model-provider imports
- advisory inference authority

The browser upload is pinned to the same-origin Phase 3 import endpoint and the route accepts only `assetId` as request-side authority.

## Production database verification

Production migration history contains:

- `20260825210845 phase_5c_phase3_import_enum`
- `20260825211003 phase_5c_phase3_import`
- `20260825211239 phase_5c_phase3_import_fk_indexes`

Direct SQL verification confirmed:

- `phase3_import` is present in `scan_job_kind`
- `security_phase3_import_runs` exists with RLS enabled
- authenticated has SELECT only
- authenticated has no INSERT/UPDATE/DELETE
- anon has no table access
- import run count is currently zero
- `persist_phase3_import_result` is `SECURITY DEFINER`
- function config pins an empty search path
- `service_role` has EXECUTE
- public/anon/authenticated have no EXECUTE
- `scan_jobs_phase3_import_snapshot_check` exists and is validated
- immutable update/delete triggers are enabled
- unique runRef and scan-job constraints are present
- composite repository asset and scan-job foreign keys are present
- all three Phase 5C FK covering indexes are present
- RLS policy is SELECT-only for authenticated workspace members

Supabase advisor state after hardening:

- security advisor: clean
- performance advisor: no unindexed-foreign-key notices for Phase 5C
- remaining performance notices are INFO-level unused indexes expected on a new/low-traffic database

Advisor reference for unused indexes: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

Live Supabase TypeScript generation independently confirmed the production schema contains:

- `scan_job_kind` value `phase3_import`
- `security_phase3_import_runs` with the expected columns
- `persist_phase3_import_result` with the expected Phase 5C arguments and JSON return

## Current no-Actions merge gate

While the monthly Actions allowance is exhausted, use this evidence instead of pretending CI ran:

1. Review every changed security-sensitive file and trust boundary.
2. Confirm no blocking PR review threads.
3. Confirm production migration history and direct SQL invariants.
4. Confirm Supabase security advisor is clean and Phase 5C has no missing-FK-index notices.
5. Confirm live-generated schema types match the application Phase 5C contract.
6. Use local TypeScript/compiler/static checks where the current environment can materialize the relevant files.
7. Merge only the exact reviewed PR head with expected-head protection.
8. Record the no-Actions verification limitation and merge SHA in the post-merge handoff.

When GitHub Actions allowance is available again, the normal full repository gate remains:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```
