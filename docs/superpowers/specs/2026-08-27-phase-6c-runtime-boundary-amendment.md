# Phase 6C runtime boundary amendment

Date: 2026-08-27
Status: authoritative amendment pending consolidation into the Phase 6C design

This note records reviewed implementation changes made after the original Phase 6C design was written. Where this note differs from `2026-08-27-phase-6c-zero-egress-scanning-design.md`, this note describes the implemented runtime boundary.

## Scanner result transport

The final Phase 6C v1 design does not persist scanner result JSON in a container tmpfs for a post-exit copy.

The Podman adapter instead uses bounded attached stdout from `podman start --attach` while container logging is disabled with `--log-driver=none`. The host accepts result bytes only when all of the following hold:

- attached output remains within the fixed 3,670,016-byte scanner-result limit
- `podman wait` returns a valid saved container exit status
- the saved exit status exactly matches the attached command exit status
- both statuses indicate success
- the attached bytes parse as the closed hosted-result JSON contract
- the trusted publication layer revalidates the result digest, scanner profile, scanner descriptors, repository identity, snapshot identity, and privacy-reduced finding/evidence schema

A non-zero scanner exit or disagreement between attached and saved exit status fails the attempt. Partial stdout from a failed scanner is never accepted as a successful result.

## Cancellation and termination ordering

Phase 6C cancellation and deadline handling use the concrete deterministic Podman container name as the killable resource boundary.

After an abort signal:

1. the Podman adapter force-removes the exact container with zero grace
2. the Phase 6C executor does not settle until the sandbox stop/removal path has completed or failed closed
3. the worker supervisor waits for that executor settlement
4. only then may the supervisor delete the staged source directory
5. only after cleanup may cancellation, lease loss, deadline failure, or other terminal state be finalized

The supervisor's older detach-on-abort wrapper remains available only to non-Phase-6C same-process worker classes. Phase 6C deliberately bypasses that wrapper because deleting staged hostile input or finalizing a lease while the scanner container can still be live would violate the sandbox boundary.

## Ambiguous Podman create state

A failed or timed-out `podman create` control operation is not treated as proof that no container object exists. Once the create command is dispatched, the deterministic container name is considered potentially live. Cleanup therefore attempts idempotent `podman rm --force --ignore <name>` even when create returns an ambiguous control failure.

This prevents orphaned deterministic container names from poisoning retries or leaving an untracked sandbox object behind.

## Runtime acceptance gate

Hosted repository scanning remains disabled in both the asset UI and server enqueue action until a real worker host proves the complete runtime gate.

The acceptance environment must provide Linux rootless Podman with delegated cgroup v2 controls and must demonstrate at minimum:

- rootless execution
- `--network=none` with failed outbound connection attempts from the scanner container
- immutable scanner image selected by digest with `--pull=never`
- read-only container root filesystem
- read-only repository and task-metadata mounts only
- no host socket, home directory, service-role credential, worker credential, lease token, or R2 authorization mounted into the sandbox
- all Linux capabilities dropped
- `no-new-privileges`
- fixed non-root container UID/GID
- PID limit enforcement
- 1 GiB memory limit and `memory.swap.max=0`
- one-CPU limit
- bounded noexec scratch tmpfs
- bounded attached stdout behavior
- abort/deadline force-removal of the actual container before supervisor cleanup/finalization

The temporary Floot verification VM used during implementation cannot satisfy this acceptance gate. Although it provides Linux, Node 22, outbound network, and user-namespace primitives, its outer sandbox does not expose the required cgroup mount and denies the privilege transitions needed to install/operate a representative rootless Podman environment. It therefore provides no evidence for runtime enablement.

Until a qualifying worker host passes these checks, `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED` must remain `false` and Phase 6C must not be described as production-operational.