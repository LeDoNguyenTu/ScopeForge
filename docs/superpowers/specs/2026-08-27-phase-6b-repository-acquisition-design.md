# Phase 6B Repository Acquisition and Private Input Artifacts

Status: awaiting written-spec approval
Date: 2026-08-27

## Goal

Phase 6B adds one narrowly scoped hosted capability: acquire the current default-branch contents of an existing public GitHub repository asset, normalize the hostile archive into a deterministic private source snapshot, and retain that snapshot long enough for a later isolated scanner phase to consume it.

Phase 6B does **not** run Phase 3 scanners, create findings, execute repository code, install packages, follow submodules, fetch Git LFS objects, or grant generic outbound network authority.

The intended product boundary is:

```text
existing repository asset
        |
        v
owner/admin snapshot request
        |
        v
trusted queue + repository-snapshot worker
        |
        +--> exact GitHub public-repository acquisition policy
        +--> hostile archive validation
        +--> deterministic source normalization
        +--> one attempt-scoped private artifact PUT
        |
        v
immutable repository source snapshot metadata
        +--> private artifact locator
```

Phase 6C may later consume a ready immutable snapshot using a separate zero-egress scanner execution class. Phase 6D remains the separately reviewed network authority for runtime/active target work.

## Existing boundaries reused

Phase 6B inherits these existing ScopeForge constraints instead of redefining them:

- Repository assets are canonicalized to `https://github.com/<owner>/<repository>` only.
- Repository targets cannot contain embedded credentials, query strings, fragments, alternate hosts, extra path segments, or non-HTTPS schemes.
- `scan_jobs` remains the canonical product job lifecycle.
- Phase 6A PostgreSQL worker tasks/attempts, exact lease tokens, retry limits, cancellation semantics, stale-worker rejection, fleet limits, and service-role-only broker authority remain authoritative.
- Worker credentials remain distinct from user sessions and are never passed to executors.
- Browser callers cannot choose execution classes, network policies, resource budgets, commands, environment variables, package-manager settings, or worker identities.
- Phase 3's hosted analysis budget is already bounded to 20,000 retained files, 2 MiB per retained file, and 256 MiB retained bytes.
- Phase 5C remains the fallback for repositories that users scan locally/CI rather than through hosted acquisition.

## Approaches considered

### A. Immutable GitHub archive acquisition - selected

The repository-snapshot worker derives `owner/repository` only from the stored repository asset, resolves the public repository's default branch to an exact commit SHA, and downloads the official GitHub archive for that immutable SHA.

Advantages:

- no Git binary
- no Git configuration or credential helpers
- no hooks
- no refspec or clone-option surface
- no submodule recursion
- no local object database
- exact commit provenance
- streamable archive validation

### B. `git clone`

Rejected for Phase 6B. It expands authority to Git configuration, protocol selection, refspecs, hooks, submodules, credential helpers, object-database behavior, executable discovery, and a large external process surface without providing a required v1 capability.

### C. Acquire repositories in the Next.js/Vercel control plane

Rejected. Large hostile network responses and archive parsing belong in an isolated worker boundary, not in the user-facing control plane.

## Threat model

### Trusted components

- ScopeForge control-plane server code
- service-role worker-control repository/service
- reviewed repository-snapshot executor implementation
- configured object-storage adapter
- PostgreSQL constraints and trusted RPCs

### Hostile or untrusted inputs

- repository contents
- archive file names and metadata
- compressed archive structure
- GitHub response bodies
- GitHub repository metadata that does not match the stored asset
- DNS answers and redirects
- stale or duplicated worker attempts
- object-store responses
- caller timing and repeated requests

### Explicitly not trusted as authority

- browser-provided repository URLs
- browser-provided branches, refs, SHAs, clone flags, headers, credentials, proxies, commands, budgets, or environment variables
- repository files such as `.gitmodules`, `.npmrc`, workflow files, package manifests, Dockerfiles, Terraform, shell scripts, or Git hooks
- a mutable branch name as final provenance
- a worker terminal result that does not match the active lease/attempt

### Main threats

- repository substitution or redirect after asset registration
- mutable-branch time-of-check/time-of-use races
- DNS/private-address rebinding
- unexpected redirect hosts
- compressed/archive bombs
- path traversal and absolute paths
- symlink/hardlink escape
- duplicate normalized paths
- special-file materialization
- oversized archives/files/file counts
- submodule and Git LFS secondary fetches
- source-artifact exposure to browsers
- presigned upload URL leakage
- cross-workspace artifact confusion
- stale-attempt overwrite/publication
- cancellation losing to successful publication
- orphan object accumulation
- storage-object corruption
- worker capability widening into generic HTTP/package/process authority

## Closed execution class

Phase 6B adds exactly one new worker execution class:

```text
repository_snapshot_github_public_v1
```

It is distinct from Phase 6A `foundation_no_egress_v1`.

A worker node remains registered for exactly one execution class. A worker does not select its class during claim. The server derives the class from the authenticated worker record.

### Fixed execution profile

The new class has one server-owned profile. Callers and workers cannot change it.

```text
executionClass: repository_snapshot_github_public_v1
networkPolicy: github_public_archive_and_attempt_artifact_put_v1
maxWallTimeMs: 300000
maxCpuTimeMs: 120000
maxMemoryBytes: 536870912
maxProcesses: 1
maxScratchBytes: 536870912
maxOutputBytes: 65536
maxTaskLifetimeMs: 1200000
```

Interpretation:

- each attempt may run for at most 5 minutes wall-clock
- each attempt may consume at most 2 minutes CPU
- memory is capped at 512 MiB
- the executor may not spawn child processes; `maxProcesses = 1` represents the executor itself
- scratch is capped at 512 MiB
- terminal metadata is capped at 64 KiB
- the task absolute deadline is 20 minutes from enqueue, allowing the existing maximum three attempts plus bounded retry delays without making the job unbounded

The supervisor still heartbeats on the Phase 6A cadence and must stop waiting at the hard attempt wall-time even if the executor ignores cooperative cancellation.

### Network policy

The execution class uses the closed policy:

```text
github_public_archive_and_attempt_artifact_put_v1
```

The policy is **not** a generic host allowlist supplied by the task. It permits only:

1. HTTPS/443 requests to the fixed GitHub API/archive hosts required for public repository metadata, immutable ref resolution, and archive transfer.
2. HTTPS/443 PUT to the exact object-storage host and exact attempt-scoped object URL issued by the trusted server for that claim.

It permits no arbitrary DNS names, IP literals, proxies, alternate ports, caller headers, arbitrary HTTP methods, or secondary repository endpoints.

The HTTP implementation must reuse the existing public-address safety model: fresh DNS resolution, complete public-address-set validation, pinned destination addresses, correct Host/SNI/certificate validation, bounded redirect handling, and deadlines.

GitHub redirects are followed manually. Redirects are accepted only when the destination remains HTTPS/443 and the host is one of the explicitly reviewed GitHub archive hosts. A repository move/rename redirect is not accepted as an asset migration; the acquisition fails and the user must update/register the correct repository asset.

The object PUT follows zero redirects.

## Repository identity and commit resolution

The worker claim does not contain a caller URL. The trusted service loads the repository asset and derives:

```text
owner
repository
canonicalRepositoryUrl
```

from the stored canonical target.

Acquisition then:

1. Fetches metadata for that exact public `owner/repository` identity.
2. Requires the returned repository identity to match the stored asset case-insensitively. Renamed/transferred repositories fail closed.
3. Requires the repository to be public.
4. Reads the current default branch from GitHub metadata.
5. Treats the default-branch value as bounded untrusted text: maximum 255 UTF-8 bytes, URL-encoded only inside the fixed GitHub API path, and never allowed to alter host, port, method, or path prefix.
6. Resolves that branch to an exact 40-hex commit SHA.
7. Requests the repository archive by that immutable commit SHA.
8. Records the default branch and resolved commit SHA as provenance.

Callers cannot request tags, historical SHAs, branches, pull requests, forks, subdirectories, or alternate refs in Phase 6B v1.

GitHub rate limiting is treated as a bounded acquisition failure. Phase 6B v1 does not introduce user OAuth, GitHub App credentials, or caller-provided GitHub tokens.

## Acquisition and archive budgets

Server-owned Phase 6B v1 limits are fixed:

- maximum compressed archive bytes received: 128 MiB
- maximum expanded regular-file bytes consumed while parsing: 512 MiB
- maximum archive entries inspected: 50,000
- maximum retained regular files: 20,000
- maximum retained size per regular file: 2 MiB
- maximum total retained regular-file bytes: 256 MiB
- maximum normalized path length: 1,024 UTF-8 bytes
- maximum normalized stored artifact bytes: 320 MiB
- one repository snapshot per acquisition task

The retained limits intentionally align with Phase 3's existing hosted analysis budget. The larger expanded-stream ceiling allows the parser to safely traverse skipped entries while still bounding decompression work.

Exceeding limits behaves as follows:

- compressed-byte, expanded-byte, archive-entry, or malformed-parser safety limits: fail the acquisition
- retained file over 2 MiB: skip that file and increment a deterministic skip counter
- retained file-count or retained-byte budget reached: stop retaining additional regular files, increment deterministic budget skip counters, and continue parsing only while parser safety limits remain satisfied
- normalized artifact over 320 MiB: fail before upload/publication

The final snapshot metadata records retained counts, skip counts, received compressed bytes, expanded bytes consumed, retained bytes, and stored artifact bytes.

## Hostile archive handling

The worker never invokes `git`, `tar`, `unzip`, a shell, a package manager, or repository code. Archive handling is an in-process streaming parser.

The GitHub archive must be a gzip-compressed tar stream. The parser requires exactly one generated top-level archive directory. That wrapper is stripped before repository-relative path validation and is never included in file identity or snapshot digests. Any entry outside the single wrapper, or multiple unrelated top-level wrappers, fails the acquisition.

Before retaining an entry, the worker validates the stripped path and type.

Rejected archive conditions:

- absolute paths
- `..` traversal after POSIX segment normalization
- NUL bytes
- invalid UTF-8 paths
- backslashes in entry paths
- empty normalized regular-file paths
- duplicate normalized regular-file paths
- paths longer than 1,024 UTF-8 bytes
- device files
- FIFOs
- sockets
- unknown/special entry types
- malformed archive structure

Directories are metadata only.

Symlinks and hardlinks are never followed or materialized. They are skipped and counted. Their targets do not trigger secondary reads.

`.gitmodules` is retained only as inert file content if it satisfies normal file limits. It never causes submodule acquisition. Git LFS pointer files are treated as inert files and never cause LFS object retrieval.

Repository files are never interpreted as configuration for the acquisition worker.

## Deterministic normalized snapshot

Phase 6B publishes a versioned normalized bundle rather than retaining the raw GitHub archive.

The bundle contract is:

```text
scopeforge-repository-snapshot-v1
```

The physical artifact is a deterministic gzip-compressed POSIX tar stream. The implementation must use an in-process archive writer, never a shell command.

For every retained regular file it preserves:

- repository-relative POSIX path
- exact file bytes
- file byte length
- SHA-256 of file bytes

The bundle also contains exactly one deterministic manifest entry named:

```text
.scopeforge/snapshot-manifest-v1.json
```

The manifest is generated by ScopeForge and cannot be supplied or overridden by repository content. If the source archive contains that path, acquisition fails with a reserved-path conflict.

Transport-irrelevant metadata is normalized:

- uid/gid are zero
- owner/group names are empty
- timestamps are Unix epoch zero
- permissions are normalized to non-executable regular-file permissions
- gzip timestamp/header variability is fixed
- tar entries are sorted deterministically by repository-relative path
- no symlink/hardlink/special entries are present

The deterministic manifest contains only stable source identity and retained-content facts:

- schema version
- canonical repository URL
- exact GitHub commit SHA
- default branch
- sorted retained file records
- deterministic skip counts
- `contentDigest`

`content_digest` is non-circular: first construct canonical JSON containing all manifest fields above **except** `contentDigest`, with object keys and retained file records in the prescribed deterministic order. SHA-256 those UTF-8 bytes. Then add the resulting lowercase 64-hex value as `contentDigest` and serialize the final embedded manifest canonically. `artifact_digest` is never embedded in the artifact because it hashes the final artifact bytes.

Operational timestamps and request/user identifiers remain in database metadata, not inside either deterministic digest.

Two hashes are recorded:

1. `content_digest`: SHA-256 over the canonical pre-digest manifest bytes defined above.
2. `artifact_digest`: SHA-256 over the exact final deterministic gzip-compressed tar bytes uploaded to object storage.

Any later Phase 6C consumer must recompute and verify `artifact_digest` before materializing or scanning the bundle, and must then recompute the embedded `contentDigest` before trusting file provenance.

## Private artifact storage

Phase 6B introduces a provider-neutral private object-store interface with an R2 adapter as the initial deployment target because ScopeForge already has server-only R2 configuration.

The bucket must not expose public object access.

The application server owns the long-lived object-store credentials. Workers never receive bucket API keys.

After a task is claimed, the trusted broker/storage adapter issues one short-lived PUT authorization for one opaque, attempt-specific object key.

Properties:

- upload key contains no repository owner/name or source path
- key is unique per task attempt
- authorization permits PUT only
- authorization expires at the earlier of the task absolute deadline and 6 minutes after claim
- worker-visible presigned URLs are treated as secrets
- logs must never record the query string or full upload URL
- upload URL is never returned to a browser
- object PUT follows no redirects

A stale worker may at worst upload to its stale attempt-specific key. It cannot overwrite the object for a newer attempt and cannot publish metadata without the current lease.

## Database model

### Public safe metadata

Add RLS-protected `repository_source_snapshots` containing only safe metadata:

- `id`
- `workspace_id`
- `asset_id`
- `scan_job_id`
- `requested_by`
- `source_kind = github_public_archive`
- `schema_version`
- `canonical_repository_url`
- `default_branch`
- `resolved_commit_sha`
- `content_digest`
- `artifact_digest`
- `compressed_bytes`
- `expanded_bytes`
- `retained_file_count`
- `retained_bytes`
- `stored_artifact_bytes`
- deterministic bounded skip-count JSON
- `created_at`
- `expires_at`

Authenticated workspace members may SELECT snapshot metadata. Browser roles have no INSERT/UPDATE/DELETE authority.

The table does **not** contain bucket names, object keys, presigned URLs, worker IDs, lease tokens, credentials, repository contents, or file lists.

Snapshot rows are immutable after creation. Artifact availability is derived from `expires_at` plus the private locator state; cleanup does not mutate source provenance.

### Private storage locator

Add a private one-to-one artifact record keyed by snapshot ID containing:

- storage provider
- opaque object key
- stored byte count
- artifact digest
- expiry
- deletion timestamp/status

No browser role and no worker receives direct table access.

Cleanup may update only the private deletion state through a dedicated trusted path.

### Attempt-scoped acquisition state

Add a private one-to-one repository acquisition record bound to the Phase 6A worker task. It contains server-derived repository identity and the opaque attempt object-key seed required for claim-time upload signing.

It does not contain caller network configuration or a reusable presigned URL.

## Job and queue integration

Add a distinct canonical scan job kind:

```text
repository_snapshot
```

Use the established enum-first migration pattern.

A repository snapshot job:

- is bound to exactly one workspace repository asset
- is requested by an authenticated owner/admin
- contains no runtime authorization target snapshot
- contains no active-validation profile
- contains no runtime request/redirect/finding counts
- is executed only by `repository_snapshot_github_public_v1`

The worker task remains bound to `(scan_job_id, workspace_id, asset_id)`.

No existing Phase 3 import, passive runtime, active validation, or finding workflow job is moved onto workers in Phase 6B.

## Request authorization and abuse controls

Only workspace owner/admin may request a hosted repository snapshot in v1.

The trusted database/service layer independently re-checks:

- actor membership and role
- workspace/asset binding
- asset kind is `repository`
- canonical repository target remains a public GitHub repository URL
- no active conflicting repository-snapshot job exists for the same asset

Fixed v1 request controls:

- at most one active repository-snapshot job per workspace through the existing worker concurrency model
- at most one acquisition request for the same asset per 5 minutes
- at most 20 acquisition requests per workspace per UTC day
- no scheduled or automatic acquisition in Phase 6B

These quotas are server/database authority and cannot be overridden by a browser or worker.

## Claim contract

The browser never talks to the worker broker.

When an authenticated repository-snapshot worker claims a task, the trusted server returns a closed task contract containing only:

- task/attempt identity
- execution class
- absolute deadline
- fixed execution budgets
- `kind = repository_snapshot_github_public`
- derived `owner`
- derived `repository`
- derived canonical repository URL
- one attempt-scoped presigned artifact PUT descriptor

It contains no caller headers, cookies, credentials, command, environment, proxy, branch/ref/SHA, clone option, package-manager option, network-policy override, or arbitrary URL.

The upload descriptor is assembled by trusted server composition after the database claim. It is not persisted as a reusable credential.

## Terminal result and publication

A successful repository-snapshot terminal envelope may return only bounded normalized provenance:

- schema version
- task/attempt/class identity
- canonical repository URL
- default branch
- resolved 40-hex commit SHA
- content digest
- artifact digest
- compressed bytes
- expanded bytes
- retained file count
- retained bytes
- stored artifact bytes
- deterministic skip counts
- fixed execution metrics

It does not return repository file content, file paths, raw archive metadata, upload URL, object key, headers, credentials, or logs.

Before publication, the trusted service verifies that the attempt-scoped object exists at the server-derived object key and that its stored byte size exactly matches the terminal result and is at most 320 MiB.

The worker is trusted software, but object storage is not trusted as the sole integrity source. A later Phase 6C consumer must recompute `artifact_digest`; a mismatch makes the artifact unusable and cannot produce scanner findings.

The database then atomically:

1. re-validates the exact active worker/task/attempt/lease binding
2. gives cancellation priority
3. validates the job/asset/workspace/requester binding
4. validates terminal repository identity and fixed bounds
5. creates immutable safe snapshot metadata
6. creates the private artifact locator
7. marks the worker attempt/task succeeded
8. marks the canonical scan job succeeded
9. appends a safe audit/worker event

Stale attempts cannot publish.

Exact replay of an already accepted terminal result is idempotent. A conflicting replay fails closed.

## Cancellation, retry, and failure semantics

Phase 6A lease/retry/cancellation rules remain authoritative.

The acquisition executor checks cancellation/control health during:

- GitHub metadata resolution
- commit resolution
- archive transfer
- archive normalization
- artifact upload

Cancellation aborts work and prevents ready snapshot publication.

Retry creates a new attempt and a new artifact object key. Older attempt objects can never become the current snapshot.

Closed Phase 6B failure provenance includes categories for:

- repository unavailable/not public
- repository identity changed
- GitHub rate limited
- GitHub acquisition/network policy failure
- archive malformed/unsafe
- archive/parser budget exceeded
- normalized artifact budget exceeded
- artifact upload/storage failure
- output invalid
- worker lost
- worker budget exceeded
- cancellation

Raw GitHub/object-store error bodies, source text, presigned URLs, and credentials are not persisted as failure detail.

## Retention and deletion

A ready repository source snapshot expires 7 days after publication in Phase 6B v1.

Rules:

- the immutable public snapshot provenance row remains after expiry
- browser/UI availability is false once `expires_at` passes, regardless of cleanup timing
- artifact bytes are deleted at/after expiry
- private locator cleanup records deletion without changing the immutable snapshot provenance
- stale/failed attempt objects are cleanup candidates within 1 hour
- an object-store lifecycle rule on the repository-input prefix provides an 8-day maximum-retention backstop even if application cleanup is delayed
- cleanup is idempotent
- cleanup never accepts caller-supplied object keys

The private artifact is classified `sensitive` even for a public repository because accidentally committed secrets may be present.

Phase 6B exposes no browser source-download feature and no presigned GET URL.

## Observability and audit

Safe operational events may include:

- snapshot requested
- task claimed
- repository identity resolved
- archive accepted/rejected
- artifact upload completed
- snapshot published
- snapshot expired/deleted
- retry/dead-letter/cancellation

Logs/events may contain workspace/asset/task IDs, commit SHA, bounded counts, failure code, worker software version, and timings.

They must not contain:

- repository file paths or source text
- raw archive headers
- presigned URLs or query strings
- object-store credentials
- GitHub authorization values
- environment variables
- secrets detected in repository content

## Architecture dependency guards

Phase 6B adds regression guards proving:

- browser/control-plane repository actions cannot import generic Node network/socket/process/archive-execution authority
- only the dedicated repository acquisition executor may import the acquisition-network adapter
- `worker-supervisor` remains free of generic target/repository network clients
- repository acquisition code cannot import package managers, child process, shell execution, runtime validator/observer authority, model providers, or finding mutation services
- repository files cannot influence commands, environment, network policy, budgets, or object keys
- Phase 5C import remains unable to acquire worker/repository execution authority
- Phase 6A foundation executor remains zero-egress
- artifact storage long-lived credentials remain server-only

## User experience

Repository asset detail may add a bounded `Prepare hosted snapshot` action for owner/admin only.

The page may show safe snapshot metadata:

- status
- exact commit SHA
- default branch
- retained file/byte counts
- creation time
- expiry time

It does not expose repository contents, file lists, object keys, bucket details, upload/download URLs, worker credentials, or raw logs.

Phase 5C local/CI import remains available independently.

## Non-goals

Phase 6B does not add:

- private GitHub repositories
- GitHub App/user OAuth credentials
- GitLab/Bitbucket/arbitrary Git hosts
- caller-selected branches/tags/commits/pull requests
- submodule acquisition
- Git LFS object acquisition
- `git clone`
- package installation
- lifecycle scripts
- builds
- Docker/Terraform/Kubernetes/cloud execution
- Phase 3 scanner execution
- finding persistence
- passive runtime observation
- active validation
- generic HTTP proxying
- browser source browsing/download
- long-term source archive storage

## Required security/regression gates

The Phase 6B implementation must include tests for at least:

1. exact repository asset/workspace/actor binding
2. owner/admin authorization and member/viewer rejection
3. request quotas and same-asset cooldown
4. no caller URL/ref/SHA/header/credential/command/budget authority
5. exact public GitHub identity match and moved-repository rejection
6. bounded default-branch handling and immutable commit resolution before archive acquisition
7. GitHub host/HTTPS/port redirect allowlist
8. DNS/private-address rejection and pinned TLS behavior
9. compressed, expanded, entry, file, retained-byte, artifact-byte, and attempt-wall-time limits
10. single GitHub archive wrapper stripping and multi-wrapper/outside-entry rejection
11. absolute path and traversal rejection
12. invalid UTF-8, NUL, backslash, overlong, reserved-manifest, and duplicate path rejection
13. symlink/hardlink non-materialization
14. special-file rejection
15. submodule/LFS non-expansion
16. deterministic normalized tar/gzip metadata
17. exact non-circular manifest/content-digest calculation and artifact digest
18. no executable bit/host ownership/timestamp preservation in normalized bundle
19. attempt-specific object key and presigned PUT only
20. no presigned URL/query logging
21. storage object existence/exact-size verification before publication
22. stale attempt cannot publish or overwrite current artifact
23. cancellation wins before publication
24. exact replay idempotency and conflicting replay rejection
25. orphan/expired artifact cleanup and 7-day expiry semantics
26. no browser artifact read/download authority
27. private table/RPC/helper privileges
28. service-role-only trusted mutation RPCs with empty `search_path`
29. live type-contract reconciliation
30. architecture guards for process/package/runtime/model/network authority separation
31. Phase 6A foundation remains zero-egress
32. Phase 5C import remains non-executing

## Production rollout gate

Before enabling the repository snapshot action:

- all Phase 6B migrations are reviewed and applied in repository order
- new trusted RPCs are `SECURITY DEFINER` with empty `search_path`
- public/anon/authenticated execute privileges are revoked from mutation RPCs
- private acquisition/artifact tables have no browser DML grants
- intended indexes/foreign keys are present
- Supabase security advisor is clean
- Phase 6B has no missing-FK-index advisor notices
- live-generated database types match the application contract
- R2/private object storage is configured with public access disabled
- repository-input lifecycle backstop is configured
- long-lived artifact signing credentials remain server-only
- production smoke uses only a disposable public repository asset and cleans all created rows/objects, or is skipped explicitly if no eligible test identity exists
- GitHub Actions are not triggered while the user's no-Actions instruction remains active

## Success criteria

Phase 6B is complete when ScopeForge can safely turn an owner/admin-selected existing public GitHub repository asset into an immutable, private, attempt-bound, exact-commit source snapshot without executing repository content, without browser-selected network/execution authority, without routing source bytes through the browser or Next.js control plane, and without yet running a security scanner.

Long-lived object-storage credentials remain confined to trusted server composition. Workers receive only one short-lived attempt-scoped PUT authorization. The resulting snapshot must be reproducible, provenance-bound, integrity-verifiable by a later consumer, cancellation/retry safe, and bounded by deterministic resource and retention limits.