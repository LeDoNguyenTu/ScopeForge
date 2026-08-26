# ScopeForge Session Handoff

## Current phase

Phase 6B public GitHub repository acquisition and private immutable source snapshots is implemented and deployed to the ScopeForge Supabase project, but the branch remains a review candidate until the exact Phase 6B pull request head is reviewed and merged.

- branch: `feat/phase-6b-repository-acquisition`
- production Supabase project: `tdgpibrepzcvdivztkta`
- GitHub Actions monthly allowance is exhausted
- do not trigger, rerun, or depend on GitHub Actions
- continue using `[skip ci]`
- never claim the full npm/Vitest/type/build gate is green unless it is actually executed

Re-check the branch head before any write because documentation closeout commits may have advanced it.

## Completed platform work

- Phase 1 foundation complete
- Phase 2 asset control/authorization complete
- Phase 3 code and supply-chain security complete
- Phase 4A security-domain contracts complete
- Phase 4B passive runtime observations complete
- Phase 4C-1 bounded CORS validation complete
- Phase 5A hosted finding foundation complete
- Phase 5B remediation/retest/Security Story complete
- Phase 5C hosted Phase 3 import complete
- Phase 6A zero-egress worker foundation complete
- Phase 6B implementation/deployment complete, pending exact-head PR merge

## Phase 6B authority boundary

The closed class is `repository_snapshot_github_public_v1`.

Phase 6B creates source snapshots only. It must not execute repository code, run package managers/hooks, use `git clone`, recurse into submodules/LFS, run Phase 3 scanners, create findings, become generic HTTP authority, or gain runtime validation authority.

Repository identity comes only from the stored canonical repository asset:

`https://github.com/<owner>/<repo>`

No browser/worker caller supplies URL/ref/branch/SHA/headers/proxy/git args/package config/commands/budgets/network policy.

The only acquisition network authority is:

- `api.github.com`
- exactly one reviewed redirect to `codeload.github.com`
- one attempt-specific presigned R2 PUT

GitHub DNS is validated against the public-network policy and the selected address is pinned into the HTTPS socket while preserving Host/SNI.

The default branch is resolved to an immutable 40-hex commit SHA before the archive is requested.

## Archive and artifact boundary

The GitHub tar/gzip stream is parsed in-process without shell/tar/git/package execution. The parser rejects unsafe paths, duplicates/shadowing, invalid UTF-8, malformed checksums/numeric fields, unsupported special entries, unreviewed PAX metadata, and archive/entry/byte/path-limit violations. Links are skipped and never followed.

Retained files are scratch-backed, lexically normalized, and written as a deterministic tar.gz with canonical manifest/content digest and artifact digest.

R2 object keys are opaque:

`repository-source/<64-hex>.tar.gz`

Long-lived R2 credentials remain server-only. The worker receives only a short-lived presigned PUT descriptor.

The PUT is create-only: SigV4 signs `If-None-Match: *` and the executor sends it, so a replayed bearer URL cannot overwrite an existing immutable object.

Server publication performs a signed R2 HEAD and requires exact object-size equality before database publication.

## Database/worker authority

Enqueue is owner/admin-only and derives exact workspace/asset/actor from trusted server state. The database enforces cooldown, workspace/day limit, one active repository snapshot job per workspace, class-aware claim, exact lease binding, bounded retries, and a 20-minute absolute task deadline.

Repository success is forbidden through the generic finalizer. Dedicated publication atomically binds worker/task/attempt/lease, repository identity, terminal provenance, R2 observed bytes, job state, replay semantics, public snapshot provenance, and private artifact state.

Cancellation wins. A forward live-hardening migration wraps the deployed publication implementation with a cancellation-first public function; the original implementation is now private and non-executable by application roles/service_role.

## Production migration history

Live Phase 6B migrations are:

- `20260826221813 phase_6b_repository_snapshot_enum`
- `20260826221849 phase_6b_repository_snapshot_schema`
- `20260826224132 phase_6b_repository_snapshot_control`
- `20260826224240 phase_6b_repository_snapshot_publication`
- `20260826224409 phase_6b_repository_snapshot_cleanup`
- `20260826224847 phase_6b_repository_snapshot_live_hardening`

Do not edit deployed migration history. Any further fix must be a forward migration.

## Live review findings fixed

1. R2 bearer URL replay could overwrite an object until expiry. Fixed with signed create-only `If-None-Match: *`.
2. Cleanup orphan eligibility depended partly on mutable task state. Fixed to attempt finished or exact lease expired, with mark-time recheck.
3. Supabase default ACL left service_role direct snapshot table authority. Forward hardening revokes all service-role table privileges.
4. Original publication had an unreachable cancelled-status branch. Forward cancellation-first wrapper fixes the race.
5. Public snapshot/private repository task `requested_by` foreign keys lacked covering indexes. Forward hardening adds both.
6. Temporary Phase 6B generic RPC casts were removed after database type reconciliation.
7. Architecture guards were extended for worker_threads, process/package execution, scanner/runtime/model authority, browser broker/object-store access, Phase 5C separation, and foundation GitHub/R2 separation.

## Live verification evidence

Direct verification confirmed:

- `repository_snapshot` enum live
- public snapshot RLS live
- authenticated member SELECT only
- anon no snapshot access
- service_role zero direct snapshot-table privileges
- intended public Phase 6B RPCs are `SECURITY DEFINER`, empty `search_path`, service-role-only
- private v1 publication helper not executable by anon/authenticated/service_role
- private repository tables have no direct application/service-role DML grants
- FK/index coverage complete
- security advisor clean
- performance advisor has no Phase 6B missing-FK-index notices
- generated public TypeScript types contain required Phase 6B enum/table/RPCs and no private schema

A rollback-only production workflow smoke passed enqueue, repository worker claim, lease-bound artifact lookup, publication, exact replay, conflict rejection, cancellation-wins, and orphan cleanup. Follow-up counts returned to zero for users/workspaces/assets/jobs/snapshots/workers/uploads/artifacts.

## Verification limitation

The current container cannot resolve `github.com` and has no dependency-complete checkout. These exact-head commands have not run:

```text
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Do not claim otherwise.

## Exact remaining Phase 6B closeout

1. Re-check exact branch head.
2. Review the complete changed-file inventory/security-sensitive diff.
3. Open the Phase 6B PR without triggering/rerunning Actions.
4. Inspect exact PR head, changed files, reviews, and unresolved review threads.
5. Fix any plausible merge blocker with `[skip ci]` and re-review the new exact head.
6. Merge only the exact reviewed head with expected-head protection.
7. Reconcile permanent docs on `main` after merge.

## Next phase

After Phase 6B is genuinely merged, start **Phase 6C isolated zero-egress Phase 3 scanning over immutable snapshots**.

Phase 6C must:

- consume only the broker-selected Phase 6B immutable snapshot
- use a new closed execution class/profile
- enforce concrete sandbox CPU/memory/process/input/scratch/output/wall-time limits
- terminate underlying sandbox resources on cancellation/deadline
- have zero target/GitHub/R2 network authority
- execute no repository code, package lifecycle scripts, package managers, build/project commands, IaC/container tooling, or hooks
- preserve deterministic Phase 3 normalization and authoritative hosted ingestion semantics
- never infer `verified_fixed` merely from absence
- keep model/advisory output downstream and non-authoritative

Dedicated runtime/active network-enabled workers remain a later separately reviewed boundary.

## Resume order

1. `docs/development/SESSION_HANDOFF.md`
2. `docs/development/CURRENT_STATE.md`
3. `docs/development/TEST_STATUS.md`
4. `docs/development/NEXT_STEPS.md`
5. `docs/ARCHITECTURE.md`
6. `docs/PHASES.md`
7. Phase 6B design/plan docs if implementation history is needed
8. Never trigger GitHub Actions while the no-Actions instruction remains active
