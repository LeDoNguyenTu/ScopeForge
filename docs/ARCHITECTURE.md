# ScopeForge Architecture

ScopeForge separates authorization, acquisition, scanner execution, runtime execution, security-state mutation, and advisory/model output. Lower-level infrastructure does not implicitly grant higher-risk authority.

The core product loop is:

`Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`

Deterministic/runtime evidence or explicit human workflow is authoritative. Model/advisory output is downstream and cannot independently promote finding validation or lifecycle state.

## Control plane and worker plane

```text
Browser
  |
  v
Next.js / Vercel control plane
  |
  +--> Supabase Auth + workspace membership
  +--> RLS-protected read models
  +--> narrow trusted server actions/routes
  |      |
  |      +--> finding/import/retest RPCs
  |      +--> worker-control RPCs
  |      +--> repository snapshot services
  |
  +--> private PostgreSQL worker queue
           |
           v
     worker-authenticated broker
           |
           v
     provider-neutral supervisor
           |
           +--> foundation_no_egress_v1
           |
           +--> repository_snapshot_github_public_v1
           |
           +--> repository_snapshot_github_private_v1
```

Workers never receive Supabase `service_role`. Browser components do not receive worker credentials, lease tokens, R2 credentials, private object keys, scanner execution authority, GitHub App credentials, GitHub installation tokens, or generic network authority.

## Phase 3 local scanner

Phase 3 remains a deterministic passive repository scanner. Repository content is hostile data. It performs bounded inventory and safe reads and does not execute target modules, package lifecycle scripts, Dockerfiles, Terraform, Kubernetes, GitHub Actions, package managers, cloud tooling, or project commands.

Phase 5C can upload a privacy-reduced normalized Phase 3 envelope, but hosted Phase 5C itself does not acquire or execute repository source.

## Product security domain

`packages/security-domain` remains framework-independent and provider-neutral. Scanner/runtime adapters map deterministic source results into findings/evidence/provenance contracts. Advisory/model output remains downstream from authoritative evidence.

## Runtime security authority

Runtime networking is separate from repository acquisition.

```text
runtime-observer --------+
                         +--> runtime-network --> network-safety
runtime-validator -------+
```

`network-safety` is pure IP/DNS policy. `runtime-network` owns reviewed target DNS/HTTPS pinning and deadlines. Passive observer and bounded active validator own separate authorization/policy semantics.

Repository assets are not valid passive-runtime or active-validation targets, and repository acquisition does not reuse runtime-network as a generic HTTP client.

## Canonical hosted finding ledger

Trusted deterministic sources enter hosted state only through reviewed persistence boundaries.

```text
passive runtime result -----+
active validation result ---+--> trusted atomic RPCs --> canonical finding/evidence ledger
Phase 5C normalized import -+
hosted repository scan ----+
```

The canonical ledger uses immutable/append-only evidence and history where designed. Missing findings from a later static scan do not automatically mean `verified_fixed`; fresh authoritative retest evidence remains required.

## Phase 5C hosted Phase 3 import

Phase 5C is normalized-data ingestion, not hosted source acquisition or execution.

The browser supplies only the selected repository asset ID. Trusted server state derives actor/workspace/role and validates the versioned privacy-reduced envelope. Phase 5C cannot import worker-control/supervisor, repository acquisition, runtime networking, process/filesystem execution, package execution, or model-provider authority.

## Phase 6A worker foundation

PostgreSQL is authoritative for worker scheduling while `scan_jobs` remains the canonical product lifecycle.

Private worker nodes/tasks/attempts/events hold scheduling state. Claims are class-aware, globally/workspace bounded, exact-lease-bound, retry-bounded, and cancellation-aware. Worker secrets and lease tokens are never placed in executor contracts.

The foundation execution class `foundation_no_egress_v1` performs only deterministic probe hashing. It has no repository, scanner, target-network, Supabase, process, or filesystem authority.

The provider-neutral supervisor owns heartbeat, cancellation, validation of terminal binding/metrics/output, and an outer hard deadline.

## Phase 6B public GitHub repository acquisition

Phase 6B adds a separate trusted acquisition class:

`repository_snapshot_github_public_v1`

It creates source snapshots only. It does not execute repository code, run package managers or hooks, use `git clone`, fetch submodules/LFS, run Phase 3 scanners, create findings, or gain runtime-validation authority.

### Trusted identity and network path

Repository identity always derives from the stored canonical repository asset:

`https://github.com/<owner>/<repo>`

No browser/worker caller can supply an arbitrary URL, ref, branch, commit SHA, request header, proxy, git argument, package-manager configuration, command, budget, or network policy.

The only acquisition network authorities are:

1. `api.github.com`
2. one reviewed redirect to `codeload.github.com`
3. one attempt-specific presigned R2 `PUT`

GitHub DNS resolution validates the complete address set against `network-safety`. A validated public address is pinned into the HTTPS socket while the reviewed hostname is retained for Host/SNI/certificate identity.

The repository metadata response must describe the exact expected public canonical repository and must satisfy `private === false`. The default branch is bounded and resolved to an immutable 40-hex commit SHA. Archive acquisition is pinned to that SHA.

### Hostile archive processing

The GitHub gzip/tar stream is parsed in-process with no shell/tar/git subprocess and no package execution.

The parser enforces checksums, strict numeric encoding, wrapper-directory structure, valid UTF-8, normalized relative paths, traversal/backslash/NUL rejection, duplicate/shadow-path rejection, bounded PAX metadata, entry/stream/expanded/retained limits, and rejection of unsupported special entries.

Symlinks and hardlinks are skipped and never followed/materialized. Retained regular files are scratch-backed. This prevents source plus normalized artifact from being held simultaneously in RAM under the fixed worker memory budget.

The retained set is lexically deterministic. The bundle contains a canonical manifest, content digest, normalized metadata, deterministic tar.gz bytes, and artifact digest.

### R2 artifact authority

Private object keys are opaque and attempt-specific:

`repository-source/<64-hex>.tar.gz`

R2 credentials stay server-only. The broker converts the raw object key into a short-lived worker-safe presigned PUT descriptor and does not return the private key itself.

The PUT is signed with fixed `If-None-Match: *` and content type. The executor sends those exact headers. This makes the object create-only: a replayed/still-valid presigned URL cannot overwrite an already created immutable snapshot.

Server publication performs a signed R2 HEAD with redirects disabled and requires the exact observed object size to equal the worker terminal's stored-artifact byte count.

### Database publication authority

Repository success is forbidden through the generic worker finalizer. The dedicated publication RPC atomically validates exact worker/task/attempt/lease binding, repository task identity, canonical repository URL, bounded provenance, job state, replay/conflict behavior, and exact server-observed object bytes before publishing safe immutable provenance and private artifact state.

A live review found a cancelled-status race in the first deployed publication function. Forward hardening now exposes a cancellation-first public wrapper. Cancelled/cancel-requested jobs route through exact-lease generic cancellation before any snapshot insert. The original publication body is a private v1 helper with direct execute revoked from application roles and `service_role`.

`public.repository_source_snapshots` is member-readable through RLS but is not directly mutable by `authenticated` or `service_role`. Service-role publication authority exists only through the reviewed `SECURITY DEFINER` RPC.

### Cleanup authority

Published artifacts expire after seven days. Orphan attempt uploads become eligible after 24 hours only when the exact attempt is finished or its lease has expired.

Cleanup lists at most 100 candidates, deletes the R2 object first, then marks/removes private database state. The database rechecks eligibility at mark time. Missing/repeated object deletion is idempotent. Public snapshot provenance is never updated or deleted by cleanup.

## Phase 10A connected GitHub projects

Phase 10A1 adds the product-level connection between a GitHub App installation, a specific repository link, a ScopeForge repository asset, immutable source acquisition, and the existing repository scanner.

The browser requests project-level actions only. Trusted server code derives workspace/actor authority, re-fetches the linked repository through the GitHub App installation, and verifies repository ID, canonical URL, visibility and active access before any acquisition intent is created.

Connected-project continuation is bound to the exact published `snapshotTaskId` and `snapshotId`. Recovery reuses the published immutable snapshot and does not silently reacquire a different repository state.

## Phase 10A2 private GitHub repository acquisition

Phase 10A2 introduces a separate private-source execution class:

`repository_snapshot_github_private_v1`

It does not widen or repurpose `repository_snapshot_github_public_v1`. Public acquisition remains fail-closed to GitHub metadata where `private === false`.

### Private credential boundary

GitHub App private keys and GitHub installation access tokens remain control-plane-only. They are never serialized into worker task input, worker terminal output, snapshot publication data, browser state, or private repository artifact metadata.

After an authenticated worker has claimed the exact private snapshot task, the control plane revalidates the linked repository with the stored GitHub App installation and resolves a temporary GitHub archive redirect. The worker receives only an attempt-bound capability:

`github_private_archive_lease_v1`

The capability is bound to:

- the exact canonical GitHub repository URL,
- the exact default branch observed during revalidation,
- an immutable 40-hex commit SHA,
- an HTTPS `codeload.github.com` archive URL bound to that repository/commit,
- a short expiry.

The private executor cannot mint, refresh, or exchange provider credentials and contains no `api.github.com` control-plane client.

### Private network boundary

The private worker network path is capability-based, not generic GitHub API authority. The worker may read the exact validated temporary codeload archive and may upload the normalized immutable artifact only through the existing attempt-scoped R2 PUT descriptor.

The worker does not receive caller-selected headers, arbitrary URLs, proxy settings, Git arguments, package-manager settings, submodule/LFS credentials, cookies, OAuth material or repository write authority.

Private acquisition does not authorize generalized target egress and does not grant the later zero-egress repository scanner any GitHub/R2 network authority.

### Private execution boundary

Private repository bytes remain hostile data. The private executor reuses the bounded in-process repository archive parser and deterministic bundle writer. It does not execute repository code, install dependencies, run Git hooks, invoke `git clone`, execute package scripts, follow submodules/LFS, run target containers, or invoke project commands.

### Private project routing and exact-snapshot continuation

A connected private repository scan performs fresh provider revalidation before enqueueing. Stored visibility is part of repository identity. A public/private visibility change fails closed as an identity mismatch rather than silently switching acquisition classes.

Private acquisition has its own default-off hosted capability:

`HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`

When the flag is not exactly `true`, the private project remains connected but no private snapshot task is queued. There is no fallback to the public snapshot enqueue path.

When enabled, a dedicated private connected-project RPC atomically creates the private snapshot task and records the project-scan intent. Successful private snapshot publication is recognized by the authenticated worker finalize route and enters the same exact-snapshot continuation used for public projects.

The repository scanner still consumes only the exact immutable published snapshot. `waiting_scan_runtime`, `retry_pending`, and replayed `scan_queued` recovery preserve the exact snapshot identity without reacquiring source.

### Private database authority

Phase 10A2 uses forward migrations rather than editing already-applied Phase 10A1 migrations.

Privileged private project enqueue, recovery and scan-continuation RPCs remain `SECURITY DEFINER`, pin `search_path = ''`, revoke browser/application execution, and grant only the reviewed `service_role` execution boundary.

The Phase 10A2 TypeScript database overlay composes the Phase 10A1 connected-project functions, the Phase 6D worker-control function surface, and the new private-repository functions so trusted server composition does not lose earlier worker-control RPC types.

### Private rollout boundary

Code implementation and CI do not authorize production private-source execution. Production activation additionally requires:

1. Phase 10A1 release/reconciliation onto the current production baseline.
2. Fresh ScopeForge Supabase migration-head and RPC ACL verification.
3. GitHub App private-repository permission verification.
4. Dedicated private worker deployment/containment verification.
5. An explicitly accepted canary and rollback window.
6. A complete private project canary from repository revalidation through immutable snapshot publication and exact zero-egress repository scan.
7. Verification that provider credentials, private source and private archive lease URLs do not appear in browser state or ordinary application logs.

The private runtime flag remains false/absent until those operational gates pass.

## Authority guards

Executable repository guards enforce security dependency direction, including:

- `security-domain` remains infrastructure/provider independent
- `network-safety` remains pure and I/O-free
- Phase 5C cannot import workers/acquisition/runtime/process/package/model authority
- acquisition network/snapshot/executor code cannot import `child_process` or `worker_threads`
- acquisition cannot invoke package managers or scanner coordinator/inventory/filesystem execution
- acquisition cannot import runtime observer/validator or model providers
- browser components cannot import R2/object-store/server snapshot authority or internal worker broker/supervisor
- foundation worker path cannot import GitHub/R2 acquisition authority
- repository snapshot normalization does not persist findings or call Phase 3 hosted import persistence
- worker supervisor remains free of repository provider credentials and generic target network authority
- public repository acquisition remains fail-closed to public GitHub metadata only
- private worker contracts/publication do not contain GitHub provider credentials
- private executor has no GitHub API control-plane authority
- worker claim remains authenticated and request-body-free
- private acquisition runtime remains default-off unless explicitly enabled
- Phase 10A2 privileged RPCs retain explicit service-role ACLs

These are security controls, not formatting conventions.

## Database privilege boundary

Trusted public operation RPCs are `SECURITY DEFINER`, pin `search_path = ''`, deny `anon`/`authenticated`, and grant execute only to `service_role` where required.

Private repository task/upload/artifact tables have no direct application or service-role DML grants. Private helper functions have direct execute revoked unless a reviewed parent function/trigger must own them.

After Phase 6B live hardening, `service_role` has zero direct privileges on `public.repository_source_snapshots`, preventing bypass of the dedicated atomic publication path.

Phase 10A2 connected-project routing preserves this model: browser roles cannot directly enqueue private worker tasks or mutate private project-scan intent state, and the public/private acquisition distinction is enforced inside trusted server/RPC boundaries.

## Evidence and secret boundary

Runtime persistence stores normalized observations instead of raw responses. Phase 5C stores privacy-reduced scanner facts instead of arbitrary source/snippet/secret content.

Repository snapshot phases intentionally store source bytes only in private R2 artifacts. The public snapshot row exposes bounded provenance and digests, not source content, object keys, presigned URLs, private archive lease URLs, GitHub tokens, or download locators.

## Repository scan isolation boundary

Hosted repository scanning consumes a broker-selected immutable repository snapshot inside an isolated zero-egress scanner execution class.

The scanner must enforce concrete sandbox limits and terminate underlying resources on cancellation/deadline. It must not gain GitHub/R2 acquisition authority, runtime-network authority, package lifecycle execution, project commands, caller-selected scanners/configuration, or generic egress.

Deterministic Phase 3 results must still pass the existing normalized authoritative ingestion model before hosted findings change.

Dedicated network-enabled runtime/active worker execution remains a separately reviewed boundary. GitHub repository acquisition networking is not general-purpose worker egress.

## Non-goals

The architecture does not authorize generalized crawling, endpoint discovery, arbitrary user-supplied origins, arbitrary methods/headers/bodies, authenticated testing, credential/cookie replay, browser automation, exploit probes, fuzzing, credential attacks, denial-of-service behavior, generalized DAST, arbitrary repository command execution, or automatic remediation.
