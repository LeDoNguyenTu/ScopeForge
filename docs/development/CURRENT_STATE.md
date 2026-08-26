# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform built around:

`Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`

Authorization, deterministic evidence, explanation, remediation, and execution authority remain separate concerns. Security state must remain attributable to deterministic/runtime evidence or explicit human workflow rather than model inference alone.

## Completed foundations

- **Phase 1 Foundation** - identity, workspaces, RLS, application shell, security headers, and deployment baseline.
- **Phase 2 Asset control and authorization** - workspace-scoped assets, canonical targets, proof of control, SSRF-safe verification, roles, quotas, audit events, and asset UX.
- **Phase 3 Code and supply-chain security** - local/passive scanner, hostile-repository safety, secrets, JS/TS SAST, SCA/SBOM, IaC/configuration analysis, baselines, JSON/SARIF, golden outputs, and benchmarks.
- **Phase 4A Security domain contracts** - framework-independent finding/evidence/provenance contracts.
- **Phase 4B Verified passive runtime observations** - verified target policy, pinned HTTPS, bounded/redacted observations, and deterministic runtime findings.
- **Phase 4C-1 Bounded CORS origin-policy validation** - separately authorized, fixed-profile active validation.
- **Phase 5A Hosted finding foundation** - canonical hosted finding/evidence/history ledger.
- **Phase 5B Remediation, deterministic retest, and Security Story** - bounded human workflow and authoritative fresh-evidence retest semantics.
- **Phase 5C Hosted Phase 3 finding import** - privacy-reduced local/CI import without hosted repository execution.
- **Phase 6A Zero-egress worker foundation** - private PostgreSQL worker queue, scoped worker identity, exact leases, retries/recovery, cancellation-wins behavior, and provider-neutral supervision.
- **Phase 6B Public GitHub repository acquisition and immutable source snapshots** - merged through PR #38. Exact reviewed feature head `6a999df6bbb849e5eb698dbc387f7ec2a82df6d6`; merge commit `79c5ac30c38e91081a7bd6256e2b77f2a0cb25dc`.

## Phase 6B repository acquisition - complete

Phase 6B creates private immutable source snapshots only. It does not execute repository code, run package managers or hooks, use `git clone`, fetch submodules/LFS, run Phase 3 scanners, create findings, or gain runtime-validation authority.

### Acquisition authority

The closed execution class is `repository_snapshot_github_public_v1`.

Repository identity derives only from the stored canonical repository asset:

`https://github.com/<owner>/<repo>`

The browser and worker caller cannot choose arbitrary URLs, refs, branches, commit SHAs, headers, proxies, commands, package-manager configuration, execution budgets, or network policy.

The only acquisition network authority is:

- `api.github.com`
- exactly one reviewed redirect to `codeload.github.com`
- one attempt-specific presigned R2 `PUT`

GitHub DNS resolution validates the complete resolved address set against the public-network policy and pins one validated address into the HTTPS socket while preserving the reviewed Host/SNI identity.

Repository metadata must identify the exact expected public GitHub repository. The default branch is bounded, resolved to an immutable 40-hex commit SHA, and the archive request is pinned to that SHA.

### Hostile archive boundary

GitHub tar/gzip is parsed in-process without shell, tar, git, package-manager, VM, or worker-thread execution.

The parser enforces:

- gzip/tar streaming bounds
- tar header checksum and strict numeric encoding
- a single GitHub wrapper directory
- absolute/traversal/NUL/backslash/invalid UTF-8 rejection
- duplicate normalized path rejection
- file-versus-descendant shadowing rejection
- bounded PAX metadata
- GitHub's initial `pax_global_header` only when its sole commit comment matches the already resolved SHA
- symlink/hardlink skip without following/materialization
- special device/FIFO/socket/unknown-entry rejection
- retained file/byte/path/count limits
- scratch-backed retained files instead of simultaneous full in-memory source/artifact copies

Retained files are lexically normalized and written into a deterministic tar.gz with normalized mode/uid/gid/mtime, canonical manifest/content digest, and artifact digest.

### R2 immutable artifact boundary

Private object keys are opaque:

`repository-source/<64-hex>.tar.gz`

Long-lived R2 credentials remain server-only. The worker receives only an attempt-specific presigned HTTPS `PUT` descriptor, never the raw private object key through the broker response.

The presigned SigV4 request is create-only: `If-None-Match: *` and the fixed content type are signed and sent by the executor. A still-valid or replayed bearer URL therefore cannot overwrite an already created immutable snapshot object.

Successful publication requires a server-side signed R2 `HEAD` and exact object-size equality before the dedicated publication RPC is called.

### Queue, publication, and cancellation authority

Repository snapshot enqueue is owner/admin-only and derives workspace/asset/actor from trusted server state. The database enforces:

- 5-minute per-asset cooldown
- 20 snapshot requests per workspace per UTC day
- one active repository snapshot job per workspace
- class-aware worker claim
- 20-minute absolute task deadline
- attempt-specific object key
- exact worker/task/attempt/lease binding
- maximum three attempts with bounded retries
- generic finalizer rejection of repository-success terminals
- dedicated atomic repository publication
- exact replay acceptance and conflicting replay rejection
- cancellation-wins behavior

A post-deployment review found that the original publication RPC validated `running` status before a later `cancelled` branch, making that cancelled-status branch unreachable. Forward migration `phase_6b_repository_snapshot_live_hardening` now keeps the original implementation private and non-executable and exposes a cancellation-first public wrapper. If cancellation was requested or the job is already cancelled, the wrapper routes through the exact-lease generic cancellation finalizer before any snapshot insert.

### Snapshot provenance and cleanup

`public.repository_source_snapshots` contains safe immutable provenance only. Workspace members may SELECT through RLS. Browser roles cannot mutate it, and `service_role` has no direct table privileges after live hardening. Publication is reachable only through the reviewed service-role RPC.

Private acquisition state includes repository task identity, attempt upload object keys, and source artifact records. These tables have no direct `anon`, `authenticated`, or `service_role` DML authority.

Snapshots retain their private artifact for seven days. Cleanup:

- lists at most 100 candidates per run
- expires published artifacts after seven days
- considers an attempt upload orphaned only after 24 hours and only when its exact attempt is finished or its exact lease has expired
- deletes the R2 object before marking database state
- treats repeated/missing object deletion idempotently
- rechecks orphan eligibility before removing the attempt-upload row
- never mutates or deletes public immutable snapshot provenance
- has no public browser cleanup endpoint

## Production database state

ScopeForge production Supabase project is:

`tdgpibrepzcvdivztkta`

Live Phase 6B migration history now includes:

- `20260826221813 phase_6b_repository_snapshot_enum`
- `20260826221849 phase_6b_repository_snapshot_schema`
- `20260826224132 phase_6b_repository_snapshot_control`
- `20260826224240 phase_6b_repository_snapshot_publication`
- `20260826224409 phase_6b_repository_snapshot_cleanup`
- `20260826224847 phase_6b_repository_snapshot_live_hardening`

Because these migrations are live, further database fixes must be forward migrations. Do not rewrite deployed Phase 6B history.

Direct live verification confirmed:

- `repository_snapshot` is present in `scan_job_kind`
- `repository_source_snapshots` has RLS enabled with authenticated member SELECT policy
- `anon` has no snapshot access
- `authenticated` has SELECT only
- `service_role` has zero direct privileges on the public snapshot table after hardening
- intended Phase 6B public RPCs are `SECURITY DEFINER`, pin empty `search_path`, and are executable only by `service_role`
- the private v1 publication helper is not executable by `anon`, `authenticated`, or `service_role`
- private repository task/upload/artifact tables have no direct application/service-role DML grants
- Phase 6B foreign keys have covering indexes, including `requested_by` indexes added by live hardening
- Supabase security advisor is clean
- performance advisor has no Phase 6B missing-FK-index notices; remaining notices are INFO-level unused-index observations expected on an empty database
- live generated TypeScript types contain the Phase 6B public enum/table/RPC surface and no private schema

A rollback-only production smoke successfully exercised repository snapshot enqueue, repository-class worker claim, canonical asset-derived GitHub identity, lease-bound artifact lookup, atomic publication, exact replay, conflicting replay rejection, cancellation-wins publication, and orphan cleanup. The transaction was rolled back and follow-up counts returned to zero.

## Verification constraint

GitHub Actions monthly allowance is exhausted and must not be used. Phase 6B implementation and closeout commits used `[skip ci]`.

The current execution container cannot resolve `github.com`, and no dependency-complete local checkout is available. Therefore these commands were not run for the merged Phase 6B head:

- `npm test`
- `npm run typecheck`
- `npm run build:cli`
- `node .scopeforge-build/packages/cli/index.js version`
- `npm run benchmark:scanner`
- `npm run build`

Do not describe those checks as green. Phase 6B acceptance evidence consists of test-first repository contracts, targeted exact-head source/security review, exact changed-file inventory, live Supabase migration/ACL/RLS/function/index verification, clean security advisor, generated-type comparison, and rollback-only production workflow smoke.

## Current boundary

**Phase 6C isolated zero-egress Phase 3 scanning over immutable repository snapshots** is the next implementation boundary.

Phase 6C may consume only an already published immutable private snapshot. It must not widen Phase 6B acquisition into generic HTTP authority, run repository/package lifecycle commands, recurse into remote submodules/LFS, or allow model/advisory output to independently change authoritative finding validation/security state.
