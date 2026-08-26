# ScopeForge Test Status

## GitHub Actions and local execution constraint

GitHub Actions monthly allowance is exhausted. The user explicitly requested no further GitHub Actions use. Phase 6B implementation, merge, and reconciliation commits use `[skip ci]` and no workflow is to be triggered, rerun, or used as merge evidence.

The current execution container cannot resolve `github.com` and no dependency-complete ScopeForge checkout is available. The merged Phase 6B head therefore has **not** executed:

```text
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Do not describe those checks as green.

## Phase 6B merge evidence

Phase 6B merged through PR #38.

- exact reviewed feature head: `6a999df6bbb849e5eb698dbc387f7ec2a82df6d6`
- merge commit: `79c5ac30c38e91081a7bd6256e2b77f2a0cb25dc`
- PR was `mergeable: true` and `mergeable_state: clean` immediately before merge
- exact-head review was recorded
- unresolved review threads: none
- expected-head SHA protection was used for merge

## Phase 6B executable repository contracts

The merged tree contains test-first contracts for:

- closed `repository_snapshot_github_public_v1` worker input/output and fixed budgets
- owner/admin repository snapshot enqueue and exact asset/workspace binding
- body-free class-aware worker claim
- exact lease/task/attempt binding
- private attempt object-key handling and broker secrecy
- GitHub-only URL construction and redirect policy
- complete DNS public-address validation and pinned HTTPS options
- immutable default-branch commit resolution
- hostile gzip/tar parsing, checksums, numeric fields, PAX metadata, paths, duplicates, special entries, links, bombs, and bounds
- deterministic manifest/content/artifact digests and tar.gz output
- R2 SigV4 PUT/HEAD/DELETE boundaries
- create-only R2 PUT using signed `If-None-Match: *`
- server-side HEAD exact-size gate
- dedicated publication and generic-finalizer rejection of repository success
- exact replay and conflict behavior
- cancellation-wins publication
- immutable public provenance and private artifact separation
- repository-only UX/read model/server action
- bounded seven-day/orphan cleanup
- database public type surface
- permanent dependency/authority guards

These tests are source-controlled acceptance contracts, but they have not been executed by Vitest in the current environment.

## Production migration verification

ScopeForge Supabase project `tdgpibrepzcvdivztkta` contains:

- `20260826221813 phase_6b_repository_snapshot_enum`
- `20260826221849 phase_6b_repository_snapshot_schema`
- `20260826224132 phase_6b_repository_snapshot_control`
- `20260826224240 phase_6b_repository_snapshot_publication`
- `20260826224409 phase_6b_repository_snapshot_cleanup`
- `20260826224847 phase_6b_repository_snapshot_live_hardening`

All future Phase 6B database corrections must be forward migrations.

Direct SQL verification confirmed:

- `repository_snapshot` exists in `scan_job_kind`
- `repository_source_snapshots` has RLS enabled
- authenticated member SELECT policy is present
- anon has no table access
- authenticated has SELECT only
- service_role has zero direct privileges on the public snapshot table after hardening
- intended Phase 6B public RPCs are `SECURITY DEFINER`
- intended public RPCs pin `search_path = ''`
- public/anon/authenticated cannot execute trusted worker/snapshot RPCs
- service_role can execute only the intended public operation RPCs
- the private v1 publication helper is not directly executable by anon/authenticated/service_role
- private repository task/upload/artifact tables have no direct application/service-role DML grants
- public snapshot provenance update/delete guards are live
- Phase 6B foreign keys and covering indexes are live
- the two `requested_by` covering indexes identified by the performance advisor are live

## Review-driven defects fixed before merge

1. **Stale presigned PUT overwrite** - SigV4 now signs `If-None-Match: *` and the executor sends it, so a replay cannot overwrite an existing snapshot object.
2. **Cleanup orphan race** - cleanup now uses monotonic attempt state: attempt finished or exact lease expired, with mark-time recheck.
3. **Default service-role table authority** - forward live hardening revokes all direct service-role privileges on the public snapshot table.
4. **Unreachable cancelled publication branch** - the public publication RPC is now a cancellation-first wrapper over a private non-executable v1 implementation.
5. **Missing actor FK indexes** - public snapshot and private repository task `requested_by` foreign keys now have covering indexes.
6. **Temporary RPC casts** - repository snapshot code uses the reconciled typed public RPC surface directly.
7. **Authority-regression gaps** - permanent guards explicitly forbid worker threads, process/package-manager execution, scanner coordinator/inventory/filesystem authority, runtime observer/validator, model providers, browser object-store/broker access, Phase 5C-to-worker authority, and foundation-worker GitHub/R2 imports.

## Advisor state

After forward hardening:

- Supabase security advisor: **clean**
- Supabase performance advisor: **no missing Phase 6B FK indexes**
- remaining performance notices: INFO-level unused-index observations, expected because the project currently has no application data and index usage statistics are not meaningful yet

Do not remove required FK/operational indexes merely because they are currently unused.

## Live generated type verification

Live TypeScript generation independently confirmed:

- `scan_job_kind` contains `repository_snapshot`
- `repository_source_snapshots` is present in the public schema
- all Phase 6B public RPCs and argument shapes are present
- the private repository tables are not emitted
- the private v1 publication helper is not emitted

The checked-in curated `lib/database.types.ts` remains intentionally smaller than a wholesale generated file while matching the required live Phase 6B public surface.

## Rollback-only production workflow smoke

A synthetic workflow was exercised inside an explicit transaction and rolled back. It passed repository asset creation, owner/admin snapshot enqueue, repository worker registration, class-aware claim, canonical asset-derived identity, exact lease-bound artifact lookup, atomic publication, exact replay, conflicting replay rejection, cancelled-job publication with no snapshot, orphan candidate selection, and orphan mark/removal.

Post-rollback verification confirmed zero users, workspaces, assets, scan jobs, repository snapshots, worker nodes/tasks/attempts, attempt uploads, and source artifact rows.

## Phase 6B acceptance statement

Phase 6B is merged based on exact-head targeted security/source/database review plus live database verification and rollback-only workflow smoke. This is deliberately **not** described as a full green CI/build result because the complete npm/Vitest/type/build suite could not run in the current environment.

Phase 6C requires separate architectural threat-model/design approval before immutable snapshots are consumed by hosted scanner execution.
