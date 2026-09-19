# Phase 11C HTTP Runtime Linux Acceptance

Acceptance date: 2026-09-19, Asia/Singapore

## Candidate and host

- source SHA: `4f388834cec38aef335f4dbf5657101171416c9e`
- source state: clean detached worktree created from live `origin/main`
- host: dedicated Oracle Cloud `VM.Standard.E5.Flex` in `ap-singapore-1`
- OS/kernel: Ubuntu 24.04, `6.17.0-1020-oracle`
- container stack: rootless Podman 4.9.3, crun, systemd cgroup v2
- enabled controllers: `cpuset cpu io memory hugetlb pids rdma misc dmem`
- worker identity: dedicated uid/gid 1002
- build runtime: Node 24.16.0, npm 11.13.0
- runtime bundle SHA-256: `05dd6f00bb5a1bf9be6b8046d3c7aeff79b4b78a7b73dba5d72acb095cee8153`
- runtime image: `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`

The image was built from the exact clean source SHA with `podman build --network=none` and the digest-pinned `deploy/worker/Containerfile.runtime`. The mutable build tag was not used for execution evidence.

## Real-host evidence

The exact image and production sandbox command completed a `phase11_http_discovery_v1` request to an authorized public HTTPS target through the one-use Unix mediator:

```text
outcome=succeeded
requestCount=1
routeKind=root
status=200
redirected=false
```

A real cross-host redirect returned 301 and was not followed:

```text
requestCount=1
redirected=false
redirectBlockedReason=CROSS_HOST
```

Direct network probes from the networkless container returned:

```text
DIRECT_TCP_BLOCKED=PASS:ENETUNREACH
DIRECT_HTTPS_BLOCKED=PASS:ENETUNREACH
LOOPBACK_BLOCKED=PASS:ECONNREFUSED
DIRECT_DNS_BLOCKED=PASS:ECONNREFUSED
UNRELATED_SOCKET_VISIBLE=PASS
```

The live container boundary reported:

```text
ROOT_WRITE_BLOCKED=PASS:EROFS
CAP_EFF=0000000000000000
NO_NEW_PRIVS=1
PIDS_MAX=8
MEMORY_MAX=268435456
MEMORY_SWAP_MAX=0
CPU_MAX=50000 100000
TMP_MOUNT=tmpfs /tmp tmpfs rw,nosuid,nodev,noexec,size=8192k
TMP_NOEXEC=PASS:EACCES
SCRATCH_CEILING=PASS:ENOSPC
MEMORY_EXIT_CODE=137
```

Lifecycle probes returned:

```text
CANCELLATION_CLEANUP=PASS elapsedMs=194 containerRemoved=true socketRemoved=true
WALL_TIME_CLEANUP=PASS elapsedMs=30274 containerRemoved=true
OUTPUT_CEILING_CLEANUP=PASS attemptedBytes=40000 ceilingBytes=32768 containerRemoved=true
```

The output probe used a temporary hostile derivative of the exact accepted image that replaced only `/app/runtime-worker-entry.js`. This exercised the production sandbox's fixed 32,768-byte Phase 11 output boundary and removal path. It is not an accepted runtime image and was never configured as a worker image.

After the acceptance probes:

- no runtime containers remained
- no mediator socket remained
- the exact candidate checkout was clean
- no production worker, migration, feature flag, or runtime environment was changed

## Focused validation

On the accepted Linux host, the Phase 11 runtime, mediator, sandbox, worker-control, result-reconciliation, image, and architecture batch passed:

```text
25 test files passed
121 tests passed
```

An earlier focused boundary batch passed 10 files and 36 tests. The exact merged `main` SHA also passed GitHub CI run `35406951340`.

## Verdict

The exact Phase 11 HTTP runtime image passes the affected rootless-Podman/cgroup-v2 containment gate for `phase11_http_discovery_v1`.

This acceptance does not apply Phase 11 migrations or enable hosted execution. A separate release must add the normal worker configuration, deploy the accepted immutable digest, register a class-specific worker identity, prove authenticated idle behavior, apply only reviewed absent migrations, and retain a tested rollback that disables the class and stops its worker without affecting the released Phase 10 workers.
