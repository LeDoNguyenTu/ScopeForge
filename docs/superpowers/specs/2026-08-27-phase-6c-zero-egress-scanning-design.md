# Phase 6C Isolated Zero-Egress Phase 3 Scanning

Status: selected for autonomous implementation
Date: 2026-08-27

## Goal

Phase 6C adds one narrowly scoped hosted capability: run ScopeForge's existing deterministic Phase 3 static scanners against an immutable Phase 6B repository snapshot inside a concrete zero-egress sandbox, then persist only the existing privacy-reduced deterministic finding/evidence model through a dedicated trusted publication path.

The intended boundary is:

```text
existing repository asset
        |
        v
latest eligible Phase 6B immutable snapshot
        |
        v
owner/admin hosted scan request
        |
        v
PostgreSQL worker task + exact lease
        |
        v
trusted host artifact staging
        |
        +--> exact snapshot object only
        +--> exact byte count + artifact SHA-256
        +--> manifest/content/file verification
        |
        v
read-only materialized source tree
        |
        v
rootless fixed-image Podman sandbox
        |
        +--> network namespace: none
        +--> fixed CPU/memory/PID/scratch/output limits
        +--> fixed ScopeForge scanner runner only
        |
        v
privacy-reduced hosted Phase 3 result
        |
        v
dedicated exact-lease publication
        |
        +--> immutable hosted scan-run provenance
        +--> canonical findings/evidence ledger
```

Phase 6C does not widen Phase 6B acquisition networking and does not move runtime/passive/active target networking to workers. That remains a later separately reviewed Phase 6D boundary.

## Existing boundaries reused

Phase 6C reuses rather than redefines:

- Phase 6B immutable repository snapshots and exact repository/workspace/asset provenance.
- Phase 6A PostgreSQL worker scheduling, worker credentials, exact lease binding, retries, cancellation heartbeat, and supervisor deadline behavior.
- Phase 3 scanner-core inventory and coordinator semantics.
- Existing built-in secret, JavaScript/TypeScript, SCA, and IaC scanners.
- Existing privacy-reduced hosted Phase 3 finding format and source registry.
- Existing canonical `security_findings`, `security_evidence`, occurrences, events, lifecycle, remediation, and retest authority.
- The rule that absence from a later static scan never proves `verified_fixed`.
- The rule that model/advisory output cannot independently promote validation or lifecycle state.

Phase 3 already bounds inventory at 20,000 files, 2 MiB per file, and 256 MiB total. Phase 6B snapshots use the same retained-file/byte ceilings and record a canonical manifest with path, byte count, SHA-256 per file, repository identity, immutable commit SHA, and content digest.

## Approaches considered

### A. Trusted host staging plus rootless fixed-image Podman sandbox - selected

The worker supervisor owns an artifact-staging step before scanner execution. The stager obtains a lease-bound, short-lived GET authorization for the exact Phase 6B object, downloads it to a private work directory, validates exact stored bytes and whole-artifact SHA-256, validates the snapshot manifest and every extracted file, then exposes only a read-only source tree to a rootless Podman sandbox.

The sandbox runs one prebuilt ScopeForge scanner image pinned by immutable image digest. It has no network, no caller-selected command, no package-manager behavior, no repository-provided environment, and host-enforced cgroup/filesystem/PID limits.

Advantages:

- source acquisition and static analysis remain distinct trust stages
- R2 authorization never enters the scanner sandbox
- hostile repository bytes cannot influence a host command line
- cancellation can kill the actual container resource
- limits are enforced by the runtime rather than trusted worker metrics
- the existing Phase 3 scanner code is reused rather than forked

### B. Scan inside the existing worker process

Rejected. The current supervisor can stop awaiting an uncooperative executor, but it cannot terminate arbitrary CPU/memory/filesystem work in the same process. Hostile-source parsing therefore needs a separate killable resource boundary.

### C. Give the scanner sandbox a presigned R2 GET

Rejected. It grants the scanner a bearer URL plus network authority and makes zero-egress dependent on application behavior instead of the runtime boundary.

### D. Scan in the Next.js/Vercel control plane

Rejected. Large hostile source trees and scanner resource consumption do not belong in the user-facing control plane and cannot receive the required OS-level sandboxing there.

## Threat model

### Security-sensitive assets

- immutable repository snapshot identity and artifact bytes
- repository source contents, including secrets accidentally committed by the user
- worker credentials and lease tokens
- temporary object-storage GET authorization
- scanner image identity and scanner/rule versions
- canonical finding/evidence state
- workspace/asset/snapshot/job binding
- host filesystem and worker runtime
- result integrity and replay semantics

### Trusted components

- ScopeForge control-plane server composition
- reviewed service-role worker/snapshot/scan repositories
- PostgreSQL constraints and trusted RPCs
- Phase 6C host artifact stager
- Phase 6C rootless Podman sandbox adapter
- prebuilt ScopeForge Phase 6C scanner image
- existing deterministic Phase 3 scanner packages and hosted-result privacy reducer

### Hostile or untrusted inputs

- every repository file byte
- repository-controlled `.gitignore` and `.scopeforgeignore`
- file names and file contents after snapshot materialization
- stale/duplicated worker attempts
- object-store responses
- scanner parser edge cases
- user timing/repeated scan requests
- malformed/tampered sandbox result bytes

### Explicitly not trusted as authority

- browser-supplied snapshot IDs, object keys, URLs, scanner lists, rules, commands, images, environment variables, resource budgets, network policy, output paths, package-manager settings, baseline state, lifecycle state, or desired scan result
- repository `.scopeforge` scanner configuration
- package manifests as execution instructions
- Dockerfiles/container definitions
- GitHub Actions/workflow files
- Terraform/Kubernetes/cloud configuration as executable instructions
- model/advisory output
- the worker terminal unless it matches the exact active task/attempt/lease and fixed execution profile

### Primary abuse paths and mitigations

1. **Artifact substitution or storage corruption**
   - Stage only the snapshot selected by the trusted database task.
   - Require exact object byte count.
   - Stream SHA-256 and require exact published `artifact_digest`.
   - Verify canonical manifest `contentDigest`, repository URL, commit SHA, file set, per-file sizes, and per-file SHA-256 before scanning.

2. **Path traversal, link escape, or special-file materialization**
   - The Phase 6B bundle already contains normalized regular files only.
   - The Phase 6C reader still independently rejects absolute/traversal/backslash/NUL/duplicate/shadowing paths, links, devices, FIFOs, sockets, unexpected tar types, unsupported PAX metadata, and files not represented exactly in the manifest.
   - Source files are materialized under a server-created temporary directory with create-exclusive writes.

3. **Repository code execution**
   - The hosted runner imports scanner packages only.
   - It never imports repository modules.
   - It never runs `git`, shells, package managers, build tools, IaC tools, Dockerfiles, workflow steps, hooks, tests, or project commands.
   - The scanner image contains no general package-install workflow and runs a fixed entrypoint.
   - Architecture tests forbid `child_process`, `worker_threads`, VM/process execution helpers, and dynamic project-module loading from the hosted scanner graph.

4. **Network escape or dependency lookup**
   - Sandbox runtime uses `--network none`.
   - Hosted SCA profile fixes OSV remote lookup to disabled.
   - Hosted runner may not import HTTP/HTTPS/net/tls/dns/runtime-network/repository-acquisition/R2 modules or use global fetch.
   - Phase 6B GitHub/R2 PUT authority is not reusable by Phase 6C.

5. **Resource exhaustion**
   - Rootless Podman on cgroup v2 is required.
   - Fixed memory, CPU quota, PID, read-only-rootfs, scratch tmpfs, and output tmpfs limits are supplied only by trusted adapter code.
   - Supervisor and adapter both enforce the absolute attempt wall-time.
   - Input size/file bounds are rechecked against the snapshot manifest before the sandbox starts.

6. **Cancellation/deadline leaves hostile work running**
   - The sandbox adapter owns the concrete container identifier.
   - `AbortSignal` triggers an unconditional container kill followed by bounded cleanup.
   - The executor does not resolve cancellation/deadline completion until the container is confirmed stopped or the sandbox control operation fails closed.

7. **Host escape through container privileges**
   - Phase 6C v1 requires Linux rootless Podman with cgroup v2.
   - Container runs as a fixed non-root UID/GID.
   - Drop all Linux capabilities.
   - `no-new-privileges` is mandatory.
   - Root filesystem is read-only.
   - No host network, device mounts, Docker/Podman socket, service-role credential, worker credential, lease token, or host home directory is mounted.
   - Only the exact source directory is mounted read-only.
   - Scanner image is selected by trusted immutable digest, never a caller or task field.

8. **Large or malicious scanner output**
   - Container result storage is a bounded tmpfs.
   - Result is copied only after the container exits.
   - Host validates exact JSON schema, maximum 500 findings, closed scanner/rule registry, canonical repository identity, and privacy-reduced evidence before publication.
   - Raw source snippets, secret values, arbitrary scanner diagnostics, local paths, and full SBOMs are never persisted.

9. **Partial scanner failure presented as authoritative success**
   - A Phase 6C successful publication requires `scannerErrorCount = 0`.
   - Any scanner diagnostic/error makes the attempt fail closed with no canonical finding mutation.
   - Retried infrastructure failures remain bounded by the worker retry policy.

10. **Stale attempt, replay, or cancellation race**
    - Successful publication has a dedicated RPC.
    - Generic worker success finalization is forbidden for the Phase 6C class.
    - Dedicated publication revalidates exact worker/task/attempt/lease, snapshot/job binding, task class, and terminal/result digest.
    - Cancellation is checked before any scan-run/finding insert and wins the race.
    - Exact replay is idempotent; conflicting replay fails.

11. **False remediation from absence**
    - A successful hosted static scan inserts/recurs findings that are present.
    - It never resolves findings that are absent.
    - `verified_fixed` remains available only through the existing authoritative retest workflow.

## Closed execution class

Phase 6C adds exactly one class:

```text
phase3_repository_scan_no_egress_v1
```

The fixed profile is:

```text
executionClass: phase3_repository_scan_no_egress_v1
networkPolicy: none
maxWallTimeMs: 300000
maxCpuTimeMs: 300000
maxMemoryBytes: 1073741824
maxProcesses: 64
maxInputFiles: 20000
maxInputBytes: 268435456
maxScratchBytes: 268435456
maxOutputBytes: 3670016
maxTaskLifetimeMs: 1200000
```

`maxProcesses` is enforced as the cgroup PID/task ceiling required for the Node runtime and its native threads. Repository code still receives no process-spawn API from ScopeForge.

One CPU is allocated to the sandbox, so the five-minute wall boundary also caps usable CPU time at five CPU-minutes. Memory is capped at 1 GiB. The output limit matches the existing hosted Phase 3 envelope boundary with a small fixed margin reserved for framing.

A worker node remains registered for exactly one execution class. Browser users never choose the class.

## Hosted scanner profile

The sandbox does not load repository `.scopeforge` scanner configuration and does not expose CLI switches.

Phase 6C v1 always enables the reviewed built-ins:

- `secrets`
- `jsts`
- `sca` with remote OSV lookup disabled
- `iac`

The built-in rule registry is fixed by the scanner image/version. No user-selected include/exclude rule list enters v1.

Repository `.gitignore` and `.scopeforgeignore` remain passive inventory inputs because the existing deterministic Phase 3 inventory semantics depend on them. Their resulting skipped-file counts remain visible in scan provenance. They can reduce coverage, but absence never resolves prior findings, so they cannot independently create a verified-fix transition.

No baseline is applied in Phase 6C v1. No SBOM file is produced. No fail-on policy changes persistence.

## Snapshot selection and enqueue

The browser action supplies only the repository asset ID.

The trusted server derives actor/workspace/role and calls an enqueue RPC. The database:

1. requires owner/admin role
2. requires an existing repository asset in the exact workspace
3. selects the newest eligible published Phase 6B snapshot for that asset
4. requires the snapshot artifact to remain active and have at least 30 minutes before artifact expiry
5. fixes the snapshot ID in private task state
6. creates a `repository_scan` scan job with the fixed Phase 6C budget
7. creates a worker task for `phase3_repository_scan_no_egress_v1`

V1 does not let the browser select arbitrary historical snapshots.

Abuse controls are fixed initially to:

- one active hosted repository scan per workspace
- 5-minute cooldown per asset
- 20 hosted repository scans per workspace per UTC day
- existing global/per-workspace worker lease limits remain in force

## Broker task contract

The claim payload contains safe immutable scan provenance only:

```text
snapshotId
canonicalRepositoryUrl
resolvedCommitSha
contentDigest
artifactDigest
storedArtifactBytes
retainedFileCount
retainedBytes
scannerProfileId = phase3-hosted-static-v1
scannerProfileVersion = 1
```

It does not contain:

- R2 object key
- R2 URL
- R2 credentials
- worker credential
- lease hash
- commands
- image reference
- output path
- scanner/rule list
- network settings
- environment variables

The supervisor retains the lease token outside the executor contract.

## Trusted artifact staging

Phase 6C introduces a supervisor-side staging component distinct from the scanner executor.

For an exact active repository-scan attempt, the supervisor asks a dedicated worker-authenticated control endpoint for a short-lived GET descriptor. Server composition calls a service-role RPC to resolve only the object key bound to the task snapshot and signs a GET for that object.

The descriptor:

- is returned only to the trusted supervisor/stager
- expires in at most 120 seconds
- uses HTTPS/443
- uses the configured R2 host only
- has the exact `repository-source/<64-hex>.tar.gz` path
- follows zero redirects

The stager streams to a create-exclusive `0600` file, rejects extra/truncated bytes, and requires the exact task `artifactDigest` before opening the bundle.

After artifact verification, the strict snapshot reader materializes files into a fresh source directory and independently validates the manifest and per-file digests. The manifest itself is treated as metadata and is not placed inside the scanner source root.

Before sandbox start:

- regular files are `0444`
- directories are `0555`
- no symlinks exist
- source file count and total bytes equal the validated manifest/task metadata

All staging files are removed in `finally` paths after success, failure, cancellation, or control loss.

## Concrete sandbox adapter

Phase 6C v1 uses a Linux rootless Podman adapter. Production workers for this execution class must run on cgroup v2 and must prove at startup that required Podman controls are available. The worker refuses registration/claim if the required runtime contract cannot be enforced.

The adapter uses `execFile`/spawn argument arrays only, never a shell command string.

The image is a server/worker-deployment configuration value pinned by immutable image digest. Tags and caller-provided image values are rejected.

The effective sandbox controls include:

```text
--network none
--read-only
--cap-drop all
--security-opt no-new-privileges
--pids-limit 64
--memory 1g
--memory-swap 1g
--cpus 1
--user <fixed non-root uid:gid>
--mount <validated host source dir>:/workspace:ro
--tmpfs /tmp:size=256m,nosuid,nodev,noexec
--tmpfs /result:size=4m,nosuid,nodev,noexec
```

A fixed reviewed seccomp profile may further narrow syscalls, but Phase 6C does not claim syscall-level network denial as its only network control. The mandatory `--network none` namespace is the primary zero-egress boundary.

The image entrypoint is fixed and receives no repository-derived command arguments. It reads `/workspace`, writes one `/result/result.json`, and exits.

The container is not auto-removed until the host has copied the bounded result file. Cleanup then force-removes the container and all local staging state.

## Cancellation and hard deadlines

The existing supervisor still supplies the orchestration wall-time and heartbeat cancellation signal.

The Podman adapter additionally:

1. tracks a container name derived only from canonical task/attempt UUIDs
2. listens to `AbortSignal`
3. sends an unconditional kill to that exact container on cancellation/deadline/control loss
4. waits for the container to stop
5. force-removes it
6. only then settles the executor promise

If runtime control cannot confirm termination, the worker fails closed and must not publish findings.

This is stronger than Phase 6A's generic outer promise boundary because the underlying hostile-work resource is explicitly terminated.

## Scanner runner

A new framework-independent hosted scanner runner reuses the existing scanner packages directly rather than invoking the user-facing CLI.

It:

1. validates that `/workspace` is a real directory
2. builds repository inventory using existing fixed default budgets
3. composes the fixed built-in scanners directly
4. forces SCA OSV remote lookup off
5. runs the existing `runScan` coordinator
6. requires zero scanner errors for success
7. serializes with the existing hosted privacy reducer
8. writes exactly one bounded JSON result file

It does not load the repository scanner config, baseline, output configuration, policy configuration, or SBOM command path.

## Result validation and privacy

After the container exits, host code checks result-file size before parsing and validates the same closed hosted Phase 3 schema used by Phase 5C.

Additional Phase 6C checks require:

- repository canonical URL equals the task snapshot
- tool name/version is an approved ScopeForge hosted scanner version
- scanner descriptors exactly equal the fixed Phase 6C profile
- scanner error count is zero
- inventory counters are within the task/snapshot budget
- maximum 500 findings
- every scanner/rule/version is accepted by the existing source registry
- secret evidence remains privacy-reduced exactly as in Phase 5C

The worker terminal carries the privacy-reduced result plus a SHA-256 result digest. Raw source, source snippets, local paths, artifact locators, scanner stdout/stderr, environment, and sandbox internals are excluded.

## Dedicated publication and canonical finding authority

Phase 6C does not reuse the user-upload `phase3_import` job or its import-run provenance table.

It reuses the normalized finding/evidence mapping semantics by extracting the Phase 5C deterministic mapping into a shared trusted module used by both paths.

A new dedicated service-role publication flow creates immutable hosted repository-scan provenance and updates the canonical finding ledger atomically.

The scan run records at minimum:

```text
workspace_id
asset_id
snapshot_id
scan_job_id
requested_by
scanner_profile_id
scanner_profile_version
tool_version
resolved_commit_sha
snapshot_content_digest
snapshot_artifact_digest
scan_started_at
scan_duration_ms
scanner_descriptors
files_analyzed
files_skipped
total_bytes
finding_count
result_digest
created_at
```

Successful publication requires:

- exact active worker/task/attempt/lease
- exact task snapshot/workspace/asset/job binding
- `repository_scan` job kind
- `phase3_repository_scan_no_egress_v1` task class
- fixed profile/version
- exact snapshot repository/commit/content/artifact identity
- cancellation not requested
- zero scanner errors
- server-validated deterministic finding/evidence rows

The generic worker finalizer must reject `succeeded` terminals for this execution class.

Exact same-attempt replay returns the prior success. Different result identity on the same attempt is a conflict.

Cancellation is evaluated before any scan-run or finding insert. Cancellation wins.

## Finding semantics

Phase 6C uses the same deterministic finding identity, evidence identity, source registry, severity/confidence/validation mapping, and recurrence rules as Phase 5C.

Present findings may create or recur canonical findings. A successful scan with zero findings is a valid run record, but it does not resolve, close, or verify any existing finding.

Static scanner output can never produce `runtime_observed`, `runtime_validated`, `user_confirmed`, `verified_fixed`, or other stronger authority than the existing Phase 3 mapping permits.

## Retry semantics

Phase 6C distinguishes deterministic failures from transient infrastructure failures.

Retryable examples:

- temporary artifact GET/storage failure
- transient Podman/runtime-control failure before scanner start
- worker/control-channel loss handled by existing recovery

Non-retryable examples:

- artifact digest/manifest mismatch
- invalid normalized snapshot bundle
- sandbox budget exceeded
- scanner produced diagnostics/errors
- invalid/oversized hosted result
- scanner/profile identity mismatch

The database finalizer owns retry/dead-letter decisions so a worker cannot choose whether a failure is retryable.

## UI/read model

Repository asset detail gains a small `Hosted static scan` section after snapshot provenance.

Owner/admin users can request a scan only when an eligible snapshot exists. Other members can view safe scan-run history.

The UI may display:

- status
- resolved commit SHA prefix
- scanner profile/version
- scan timestamp/duration
- files analyzed/skipped
- finding count

It never displays source, R2 locators, worker IDs, lease data, sandbox commands, container IDs, local staging paths, or raw scanner diagnostics.

## Database boundary

Phase 6C requires forward-only migrations that:

- add `repository_scan` to `scan_job_kind`
- extend worker node/task class constraints with `phase3_repository_scan_no_egress_v1`
- add the fixed scan-job budget/authorization constraint
- add private exact snapshot-bound scan task state
- add immutable member-readable public hosted repository-scan run provenance
- add enqueue, artifact-resolution, and dedicated publication RPCs
- make all trusted mutation RPCs `SECURITY DEFINER`, `search_path = ''`, service-role-only
- keep private table/helper execution/DML unavailable to anon/authenticated/service_role except through reviewed parent RPCs
- add all FK covering/claim indexes before production reconciliation

Deployed Phase 6A/6B/5C migration history is immutable. Any correction after deployment is a new forward migration.

## Architecture guards

Permanent tests must enforce at least:

- hosted scanner runner cannot import CLI config loading, CLI command parsing, runtime-network, runtime observer/validator, repository acquisition networking, R2, Supabase/admin, model providers, generic HTTP/HTTPS/net/tls/dns, child processes, worker threads, VM, or package execution
- hosted scanner runner cannot enable OSV remote lookup
- sandbox adapter is the only Phase 6C package allowed to import `node:child_process`
- sandbox adapter cannot import scanner packages, Supabase, worker credentials, Phase 5C import service, runtime-network, or repository acquisition networking
- scanner image/command comes only from trusted deployment configuration
- browser/components cannot import worker control, stager, object store, sandbox, or scanner runner
- Phase 5C local import remains independent from workers/sandbox
- Phase 6B acquisition worker cannot import Phase 6C scanner/sandbox packages
- Phase 6C stager cannot import GitHub acquisition code or R2 PUT signing
- foundation worker remains independent from GitHub/R2/scanner/sandbox authority
- generic worker success finalization cannot finalize repository scans

## Operational prerequisites

Phase 6C code may merge before production scanning is enabled, but the product action must remain disabled until a compatible worker exists.

A production Phase 6C worker requires:

- Linux
- rootless Podman
- cgroup v2 with enforceable CPU/memory/PID controllers
- the approved scanner image already present locally by immutable digest, so task execution never pulls an image from a registry
- no Docker/Podman socket exposed inside the scanner container
- worker outbound connectivity only for the ScopeForge control channel and the exact short-lived snapshot staging GET; the sandbox itself has no network

Startup self-check must fail closed if these prerequisites are missing.

## Verification strategy

### Repository tests

Add test-first contracts for:

- execution class/profile/worker contract validation
- owner/admin enqueue and newest eligible snapshot selection
- expiry/cooldown/daily/active limits
- claim class binding
- artifact descriptor secrecy and exact-lease access
- presigned GET closed host/path/method/expiry policy
- staged byte count and SHA-256 verification
- strict snapshot bundle extraction and manifest/file verification
- duplicate/path/link/special-entry/extra-file/truncation/tamper rejection
- scanner profile fixes OSV off and ignores repository scanner config
- runner produces only privacy-reduced hosted output
- Podman command construction has fixed image/entrypoint/network/resource/security options
- no shell interpolation
- abort kills/removes the concrete container
- result cap/schema/profile/source-registry validation
- dedicated publication/replay/conflict/cancellation behavior
- no finding mutation on scanner errors
- zero-finding success does not resolve previous findings
- architecture dependency guards

### Live database verification

Before merge:

- apply reviewed forward migrations to the ScopeForge Supabase project
- verify enum/constraints/FKs/indexes/RLS/ACL/function privileges/search paths
- verify no direct service-role mutation on public run provenance
- run security advisor
- run performance advisor and resolve Phase 6C missing-FK-index notices
- compare live generated public TypeScript schema with checked-in public surface

### Rollback-only workflow smoke

If production still contains no real workspace data, use a rollback-only transaction to exercise:

- synthetic owner/workspace/repository asset
- eligible existing snapshot/artifact metadata
- Phase 6C enqueue
- class-aware worker claim
- exact snapshot artifact resolution
- successful dedicated publication with one privacy-reduced deterministic finding
- exact replay
- conflict rejection
- cancellation-wins
- zero-finding success without lifecycle resolution

All synthetic rows must disappear on rollback.

### Sandbox verification

A true Phase 6C acceptance additionally requires a Linux environment with rootless Podman/cgroup v2 to prove:

- network is unavailable inside the scanner container
- read-only input/root filesystem enforcement
- memory/PID/CPU controls are accepted and active
- output/scratch bounds
- cancellation kills the underlying container
- repository files cannot select the image or command

If that runtime is unavailable in the current execution environment, repository/database work may proceed but production scan enablement must remain off and documentation must state the missing sandbox-runtime evidence precisely.

## Non-goals

Phase 6C does not add:

- private GitHub repositories or GitHub credentials
- arbitrary repository refs/snapshots selected by callers
- package installation
- package lifecycle scripts
- build/test execution
- dynamic plugin execution
- target HTTP requests
- runtime validation
- browser automation
- exploit execution
- fuzzing
- endpoint discovery
- model-controlled scanning
- automatic remediation
- automatic finding resolution from absence
- user-selected scanner images/commands/rules/network/budgets

## Acceptance criteria

Phase 6C is complete only when:

1. The exact snapshot/workspace/asset/job/attempt/lease binding is enforced by code and database constraints.
2. Scanner sandbox receives no R2/GitHub/control credentials or network access.
3. Snapshot artifact/manifest/file integrity is reverified before scan.
4. A concrete rootless Podman sandbox enforces fixed zero-egress and resource boundaries.
5. Cancellation/deadline terminates the underlying container.
6. Existing deterministic Phase 3 scanners run under a fixed hosted profile with OSV disabled.
7. Only privacy-reduced, server-validated results may mutate canonical findings.
8. Partial scanner errors cannot publish canonical findings.
9. Absence cannot resolve or verify findings.
10. Browser roles cannot acquire execution/storage/database mutation authority.
11. Live database privileges/advisors/types are reconciled.
12. Full test/build/sandbox claims are made only where executable evidence actually exists.
