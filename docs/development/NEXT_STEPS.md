# ScopeForge Next Steps

## Current closeout boundary - Phase 6B repository acquisition

Phase 6B implementation is complete on `feat/phase-6b-repository-acquisition` and its reviewed database schema is deployed to ScopeForge Supabase project `tdgpibrepzcvdivztkta`. The branch is still a review candidate until its exact head is reviewed and merged.

Delivered:

- closed worker class `repository_snapshot_github_public_v1`
- owner/admin-only repository snapshot enqueue derived from the selected stored asset
- GitHub public repository identity fixed to `https://github.com/<owner>/<repo>`
- default branch resolved to an immutable 40-hex commit SHA
- only `api.github.com`, one reviewed `codeload.github.com` redirect, and one attempt R2 PUT are network-authorized
- complete DNS public-address validation with pinned HTTPS socket and preserved Host/SNI
- streamed hostile tar/gzip validation with strict path, type, checksum, PAX, entry, byte, and retention bounds
- symlink/hardlink skipping without following or materialization
- deterministic lexical normalization, canonical manifest/content digest, deterministic tar.gz, and artifact digest
- scratch-backed source/artifact processing within the worker memory boundary
- server-only R2 SigV4 credentials
- opaque `repository-source/<64-hex>.tar.gz` object keys
- create-only signed upload using `If-None-Match: *`, preventing stale bearer URLs from overwriting a published object
- server-side signed R2 `HEAD` and exact object-size gate before publication
- dedicated atomic publication RPC; repository success is rejected by the generic worker finalizer
- exact replay/conflict semantics and cancellation-wins behavior
- immutable member-readable snapshot provenance with no browser mutation/download locator
- seven-day private artifact retention and bounded, idempotent cleanup
- permanent architecture guards keeping scanners, process execution, runtime authority, models, Phase 5C, browser code, and foundation workers outside acquisition authority

## Live Phase 6B hardening

Deployment review found and fixed three concrete issues before merge:

1. Supabase default ACL gave `service_role` direct mutation authority on `public.repository_source_snapshots`. Forward hardening revokes all direct service-role table privileges, so publication is RPC-only.
2. The original publication RPC checked `status = running` before a later cancelled-status branch, making that branch unreachable. A forward cancellation-first wrapper now routes cancelled jobs through exact-lease generic cancellation finalization before any snapshot insert.
3. `requested_by` foreign keys on the public snapshot and private repository task tables lacked covering indexes. Both indexes are now live.

The original deployed publication implementation is now a private v1 helper that is not executable by application roles or `service_role`.

## Production verification

Live migration history includes Phase 6B through:

`20260826224847 phase_6b_repository_snapshot_live_hardening`

Verification confirmed:

- Phase 6B enum/table/RPC schema is live
- authenticated workspace members have snapshot SELECT only
- anon has no snapshot access
- service_role has zero direct snapshot table privileges
- public Phase 6B mutation RPCs are `SECURITY DEFINER`, use empty `search_path`, and are service-role-only
- private repository state has no direct application/service-role DML grants
- private publication/helper functions are not directly executable by application roles/service_role
- covering FK/index set is complete
- security advisor is clean
- performance advisor has no Phase 6B missing-FK-index notices
- generated public TypeScript types match the intended Phase 6B surface and omit private tables/functions

A rollback-only live smoke passed enqueue, repository-class claim, lease-bound artifact lookup, publication, exact replay, conflicting replay rejection, cancellation-wins, and orphan cleanup. The transaction rolled back and all application/worker/snapshot counts returned to zero.

## Verification constraint

Do not use GitHub Actions. The monthly allowance is exhausted and the user explicitly requested no further Actions use.

Continue using `[skip ci]`. The current execution environment cannot resolve `github.com` and has no dependency-complete checkout, so the following final-head checks remain unexecuted unless another runnable environment becomes available:

```text
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Never label them green without fresh executable evidence.

## Immediate closeout steps

1. Review the exact final Phase 6B diff and changed-file inventory.
2. Open the Phase 6B pull request without triggering/rerunning Actions.
3. Inspect review threads and exact PR head.
4. Merge only the exact reviewed head with expected-head protection when no merge-blocking finding remains.
5. Reconcile permanent docs on `main` after merge.

## Next major boundary - Phase 6C isolated zero-egress scanner execution

Phase 6C should consume the immutable Phase 6B snapshot as a private scanner input while preserving the existing deterministic Phase 3 semantics.

Required properties:

1. Scanner execution receives only the broker-selected immutable snapshot and closed scan profile.
2. No GitHub/R2 acquisition credential or presigned PUT reaches the Phase 6C scanner executor.
3. No target network egress is allowed during scanning.
4. No repository code, package lifecycle script, build tool, package manager, Git hook, container definition, IaC tool, or project command is executed.
5. Archive extraction/consumption must remain path-safe, bounded, and isolated from the host filesystem.
6. CPU, memory, process, input, scratch, output, and wall-time limits must be enforceable by the concrete sandbox adapter, not merely advisory metrics.
7. Cancellation and hard deadlines must terminate underlying sandbox resources.
8. Scanner outputs must pass the existing closed deterministic normalization/ingestion boundary before findings can enter canonical hosted state.
9. Absence from a scan must not automatically mean `verified_fixed`.
10. Model/advisory output remains downstream and cannot independently change authoritative validation or lifecycle state.
11. Phase 6C must not gain generic HTTP, runtime-observer, runtime-validator, GitHub acquisition, or R2 upload authority.

## Later Phase 6 boundary

Dedicated network-enabled runtime/active worker execution remains separately reviewed after zero-egress scanning is demonstrated. Do not reuse Phase 6B acquisition networking as a shortcut for runtime/active egress.

## Resume protocol

Before new implementation work:

1. Read `SESSION_HANDOFF.md`, `CURRENT_STATE.md`, `TEST_STATUS.md`, and this file.
2. Read `docs/ARCHITECTURE.md` and `docs/PHASES.md`.
3. Re-check the exact branch/main head and production migration history.
4. Never edit already deployed Phase 6B migration history; use forward migrations only.
5. Preserve create-only R2 upload, cancellation-first publication, RPC-only snapshot mutation, private-table isolation, and Phase 5C/6A authority separation.
6. Begin Phase 6C with an explicit threat model and approved design before scanner execution code.
