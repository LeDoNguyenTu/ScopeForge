# ScopeForge Session Handoff

## Current phase

Phase 6B public GitHub repository acquisition and private immutable source snapshots is complete and merged through PR #38.

- reviewed Phase 6B feature head: `6a999df6bbb849e5eb698dbc387f7ec2a82df6d6`
- Phase 6B merge commit: `79c5ac30c38e91081a7bd6256e2b77f2a0cb25dc`
- production Supabase project: `tdgpibrepzcvdivztkta`
- GitHub Actions monthly allowance is exhausted
- do not trigger, rerun, or depend on GitHub Actions
- continue using `[skip ci]`
- never claim the npm/Vitest/type/build gate is green unless it is actually executed

The next architectural boundary is Phase 6C isolated zero-egress Phase 3 scanning over immutable Phase 6B snapshots.

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
- Phase 6B public GitHub acquisition/private immutable snapshots complete and merged

## Phase 6B invariants that Phase 6C must preserve

- repository identity comes only from the stored canonical repository asset
- acquisition network authority is only GitHub API, one reviewed codeload redirect, and one attempt R2 PUT
- the resolved default branch becomes an immutable 40-hex commit SHA before archive acquisition
- hostile source is parsed without shell/tar/git/package/project execution
- R2 object keys are opaque and private
- the signed PUT is create-only using `If-None-Match: *`
- server publication requires signed HEAD exact-size equality
- repository success cannot use the generic finalizer
- cancellation wins before snapshot publication
- public snapshot provenance is immutable and member-readable only
- service_role has zero direct privileges on the public snapshot table
- private repository task/upload/artifact tables have no direct application/service-role DML grants
- Phase 5C cannot gain worker/acquisition authority
- foundation workers cannot gain GitHub/R2 authority

## Production migration history

Live Phase 6B migrations are:

- `20260826221813 phase_6b_repository_snapshot_enum`
- `20260826221849 phase_6b_repository_snapshot_schema`
- `20260826224132 phase_6b_repository_snapshot_control`
- `20260826224240 phase_6b_repository_snapshot_publication`
- `20260826224409 phase_6b_repository_snapshot_cleanup`
- `20260826224847 phase_6b_repository_snapshot_live_hardening`

Do not edit deployed migration history. Any later correction must be a forward migration.

## Phase 6B verification evidence

Direct live verification confirmed RLS, authenticated member SELECT-only provenance, anon denial, zero direct service-role snapshot-table privileges, service-role-only `SECURITY DEFINER` public operation RPCs with empty `search_path`, non-executable private publication helper, private-table isolation, FK/index coverage, clean security advisor, resolved Phase 6B FK-index advisor findings, and public generated TypeScript types without private schema.

A rollback-only production workflow smoke passed repository enqueue, repository worker claim, exact lease-bound artifact lookup, atomic publication, exact replay, conflicting replay rejection, cancellation-wins, and orphan cleanup. Follow-up counts returned to zero.

## Verification limitation

The current container cannot resolve `github.com` and has no dependency-complete checkout. These commands were not run for the merged Phase 6B head:

```text
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Do not claim otherwise.

## Phase 6C boundary

Phase 6C must consume only the broker-selected immutable Phase 6B snapshot under a new closed execution class.

It must:

- have zero target/GitHub/R2 network authority
- expose no arbitrary URL, object key, scanner selection, command, environment, or budget input to callers
- verify immutable snapshot provenance before scan use
- isolate snapshot materialization from the host filesystem
- enforce concrete CPU, memory, process, input, scratch, output, and wall-time limits
- terminate underlying sandbox resources on cancellation/deadline
- execute no repository code, package lifecycle scripts, package managers, build/project commands, IaC/container tooling, or hooks
- invoke only trusted deterministic Phase 3 scanner libraries
- preserve existing normalized authoritative ingestion semantics
- never infer `verified_fixed` merely from absence
- keep model/advisory output downstream and non-authoritative

Dedicated runtime/active network-enabled workers remain a later separately reviewed boundary.

## Resume order

1. Re-check exact `main` and active branch heads and production migration history.
2. Read `CURRENT_STATE.md`, `TEST_STATUS.md`, `NEXT_STEPS.md`, `docs/ARCHITECTURE.md`, and `docs/PHASES.md`.
3. Threat-model Phase 6C before implementation.
4. Present and approve the Phase 6C architecture before writing execution code.
5. Write the approved design/spec and implementation plan.
6. Implement with RED then minimal GREEN checkpoints and `[skip ci]` while GitHub Actions remain unavailable.
