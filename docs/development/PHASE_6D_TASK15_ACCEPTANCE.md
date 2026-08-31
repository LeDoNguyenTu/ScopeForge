# Phase 6D Task 15 Containment Acceptance

Acceptance date: 2026-09-01 (Asia/Singapore)

## Candidate and host

- implementation SHA: `faec75ed74e3e919c61d6ac80f249c56ee7f1885`
- branch: `feat/phase-6d-network-workers-v1-task14`
- base: `design/phase-6d-network-workers-v1` at `2be96ada2cf511b186d5e994c214e12683e76802`
- host: dedicated Oracle Cloud `VM.Standard.E5.Flex`, 4 vCPU, 8 GB, `ap-singapore-1`, AD 1
- OS/kernel: Ubuntu 24.04.4 LTS, `6.17.0-1020-oracle`
- container stack: rootless Podman 4.9.3, crun 1.14.1, systemd cgroup v2
- enabled controllers: `cpuset cpu io memory hugetlb pids rdma misc dmem`
- worker identity: dedicated uid/gid 1002 with separate 65,536-entry subordinate uid/gid ranges
- Node: 22.23.2
- runtime image: `localhost/scopeforge-runtime-worker@sha256:04b5a5e4cf6b77ac3bf0f74a3126df15305ed1d337e11a8e00d13eef46fc9e43`
- application bundle SHA-256: `11bd0ab9e2eb772e395455a75230b52c97cab913025839b7e971c7b9df983e79`

The image was built from a clean checkout of the implementation SHA and invoked by immutable digest. The documentation commit containing this record is identified separately by Git and the PR because a commit cannot embed its own hash.

## PID ceiling decision

The original `--pids-limit=1` was invalid for Node 22 because the cgroup pids controller counts threads as tasks. Limits 2 and 4 did not support startup. Limit 6 exited but emitted `pthread_create: Resource temporarily unavailable` in all 10 repeated trials. Limit 7 was healthy in 10/10 trials but used `pids.current=7` against `pids.max=7`, leaving no margin. Limit 8 was healthy in 10/10 trials with seven observed tasks and one task of explicit headroom.

The selected ceiling is therefore 8: the smallest measured value that supports the fixed Node entry with one task of margin. It remains a tight exhaustion boundary. It does not add a ScopeForge process-spawn API, shell, generic command, or network authority.

The change followed red-green-refactor: the focused command test first failed against limit 1, the production command was changed to 8, and focused/architecture coverage then passed. The same method was used for the read-only socket bind, Node 22 pinned-family fix, and usable bounded scratch mount.

## Real-host evidence

The production command retained `--network=none`, `--read-only`, `--cap-drop=all`, `--security-opt=no-new-privileges`, `--memory=256m`, `memory.swap.max=0`, `--cpus=0.5`, `--log-driver=none`, fixed uid/gid 65532, and `--unsetenv-all`. It now uses `--pids-limit=8`, an 8 MiB `rw,nosuid,nodev,noexec` scratch tmpfs with mode 1777, and a single explicitly read-only mediator socket bind.

Representative raw results:

```text
ROOT_WRITE_BLOCKED EROFS
DIRECT_DNS_BLOCKED_PASS
TCP_BLOCKED ENETUNREACH
DIRECT_PUBLIC_TCP_BLOCKED_PASS
DIRECT_PUBLIC_HTTPS_BLOCKED_PASS
LOOPBACK_BLOCKED ECONNREFUSED
CapEff: 0000000000000000
NoNewPrivs: 1
tmpfs /tmp tmpfs rw,nosuid,nodev,noexec,size=8192k
SCRATCH_NOEXEC_BLOCKED EACCES
CPU_MAX=50000 100000
CPU_LIMIT_PASS
MEMORY_MAX=268435456
MEMORY_SWAP_MAX=0
MEMORY_CURRENT_PEAK=265646080
MEMORY_EXIT_STATUS=137
MEMORY_SWAP_LIMIT_PASS
```

The production mediator/worker integration produced:

```text
PINNED_HTTPS_DIAGNOSTIC=PASS status=200
PASSIVE_REAL_HTTPS=PASS requestCount=1 redirectCount=0
ACTIVE_REAL_HTTPS=PASS requestCount=1
ACTIVE_REPLAY_REJECTED=PASS outcome=failed
PRIVATE_TARGET_REJECTED=PASS outcome=failed
PINNED_HTTPS_INFLIGHT_ABORT=PASS
```

The real Podman lifecycle and socket-root probes produced:

```text
PODMAN_CANCELLATION_CLEANUP=PASS elapsedAfterAbortMs=87
PODMAN_WALL_TIME_CLEANUP=PASS elapsedMs=30265
PODMAN_OUTPUT_CEILING_CLEANUP=PASS attemptedBytes=70000 ceilingBytes=65536
SOCKET_ROOT_SYMLINK=REJECTED
SOCKET_ROOT_NON_DIRECTORY=REJECTED
SOCKET_ROOT_WRONG_OWNER=REJECTED
SOCKET_START=PASS mode=666
SOCKET_CLOSE_CLEANUP=PASS
SOCKET_ROOT_NORMAL_CLEANUP=PASS mode=700
```

The focused Linux batch passed 43 files and 161 tests, covering mediator profiles/protocol/privacy/replay, sandbox command/runtime/architecture, supervisor preparation/execution/finalization, cancellation, result validation, atomic publication, recovery, and the permanent Phase 6D architecture boundary.

## Matrix verdict

| # | Requirement | Verdict and evidence |
|---:|---|---|
| 1 | Rootless Podman and cgroup v2 | PASS - Podman reported rootless true, systemd manager, cgroup v2 and the controllers above. |
| 2 | Exact generated command starts | PASS - both closed classes ran through the production sandbox command. |
| 3 | Immutable image | PASS - digest reference recorded above. |
| 4 | Direct DNS blocked | PASS - direct executor probe failed under `--network=none`. |
| 5 | Direct public TCP blocked | PASS - `ENETUNREACH`. |
| 6 | Direct public HTTPS blocked | PASS - direct HTTPS could not complete. |
| 7 | Loopback/host TCP blocked | PASS - loopback probe could not reach the host listener. |
| 8 | Only dedicated mediator socket usable | PASS - exact one-file bind connected; production integration completed only through it. |
| 9 | Unrelated Unix sockets absent | PASS - generated command exposes one validated socket path and no socket directory; architecture tests pin this. |
| 10 | Authorized HTTPS only through mediator | PASS - direct egress failed while prepared passive/active operations succeeded through the mediator. |
| 11 | Prohibited destinations rejected | PASS - real private-target integration failed and public-address classification tests cover private, loopback, link-local, multicast and reserved ranges. |
| 12 | Active CORS exactly one request | PASS - real request count 1. |
| 13 | Active replay rejected | PASS - second use failed. |
| 14 | Passive attempt-wide budgets | PASS - Linux profile/protocol/result tests passed; fixed request, redirect, byte, input, output and time limits remain production constants. |
| 15 | Cancellation before authorization | PASS - authoritative-cancellation and preparation tests passed with no authorized transport call. |
| 16 | In-flight HTTPS abort | PASS - real pinned HTTPS abort completed. |
| 17 | Executor terminated before cleanup | PASS - real abort awaited Podman removal; absence was asserted before mediator teardown. |
| 18 | Late success discarded | PASS - authoritative cancellation/publication tests passed. |
| 19 | PID/thread ceiling | PASS - cgroup limit 8; repeated measurement and below-limit degradation recorded above. |
| 20 | CPU ceiling | PASS - `cpu.max=50000 100000`; throttling increased during load. |
| 21 | Memory/swap ceilings | PASS - 256 MiB, swap zero, OOM kill and exit 137 under pressure. |
| 22 | Scratch ceiling/properties | PASS - 8 MiB tmpfs, `noexec,nosuid,nodev`; write succeeded for fixed uid and execution failed `EACCES`. |
| 23 | Input/output ceilings | PASS - contract tests passed and a real 70,000-byte output was rejected above the 65,536-byte ceiling with container cleanup. |
| 24 | Wall-time termination | PASS - hostile active workload was terminated and removed after the bounded execution plus cleanup window. |
| 25 | No mediator-failure fallback | PASS - architecture/runtime tests passed and executor direct networking remained unavailable. |
| 26 | Read-only socket bind connectable | PASS - real rootless Podman bind with `,ro` connected. |
| 27 | Regression and production tightening | PASS - test failed first, production bind gained `,ro`, then passed. |
| 28 | Writable fallback | NOT APPLICABLE - read-only bind works; no writable fallback retained. |
| 29 | Unsafe socket roots rejected | PASS - symlink, non-directory and root-owned directory all rejected on host. |
| 30 | Startup failure cleanup | PASS - permission/startup regression coverage passed; real normal close left no socket/listener. |
| 31 | Terminal cleanup | PASS - cancellation, wall-time, output-ceiling and normal completion left no containers or socket files. |

## Commands and artifacts

The acceptance used clean-checkout image builds followed by the production TypeScript entry points bundled with the repository's pinned esbuild. Principal commands were:

```text
podman build --network=none ...
podman image inspect ...
podman run <exact generated arguments> <immutable image>
npm test -- tests/runtime-worker-mediator tests/runtime-worker-sandbox tests/runtime-workers tests/architecture/phase6d-runtime-workers.test.ts
```

Host-only raw logs were captured under `/var/tmp/scopeforge-task15-*` during execution. This document retains the security-relevant results without mediator nonces, credentials, sensitive request data, or unnecessary resolver output.

## Limitations and enablement state

This is containment acceptance for the tested Linux/rootless-Podman/cgroup-v2 configuration. It is not evidence for a different runtime, Podman version, kernel policy, image, command, or source change. Rebuilds or containment changes require affected revalidation.

Task 15 does not itself enable production. At acceptance and through the disabled merge boundary:

```text
HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED=false or absent
HOSTED_ACTIVE_CORS_WORKER_ENABLED=false or absent
HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED=false
HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED=false
```

No DNS, Cloudflare, R2, production worker fleet, or runtime-capability change was made.
