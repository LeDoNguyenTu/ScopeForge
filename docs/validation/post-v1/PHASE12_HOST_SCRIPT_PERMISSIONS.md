# Phase 12 host script permissions

On 2026-10-28, read-only checks of the accepted Oracle host confirmed the dedicated worker service uses Node 24.16.0, rootless Podman is available, cgroup v2 is active, and the exact pinned Node base image is present.

An isolated detached worktree was created at `/home/scopeforge-worker/phase12-acceptance-20261028` for source `9324dd177bd75b060b197416f3025eb10d28c194`. Invoking `scripts/phase12-provider-containment-bundle.sh httpx linux-amd64` stopped immediately with `Permission denied`. No provider staging, containment run, worker registration, database mutation or provider enablement occurred.

Git records the coordinator and Linux containment helper as mode `100644`; both require `100755` because the documented procedure and coordinator invoke them directly. The other three invoked helpers already have executable mode. This patch corrects the two modes and adds a portable Git-index regression check covering all five helpers.

The new guard failed before correction and passed afterward. Eleven focused host-tooling tests passed; the existing Bash syntax check failed on Windows because it passes a Windows path to Bash. Linux CI and the real host run remain required; no test or containment control was weakened.

The first corrected host attempt then stopped because `unzip` was absent. Ubuntu package `unzip=6.0-28ubuntu4.1` was installed after a simulation confirmed one new package with no upgrade or removal. The coordinator now checks `curl` and `unzip` before installing dependencies or building. No worker service or container restart was required.

The immutable httpx candidate built as `localhost/scopeforge-httpx-worker@sha256:4720435ac38908608984cca8046e974c4bc8dc4d3608c7e65d2d56a0bddb11cc`. Its Node DNS preflight exited 139 under `--pids-limit=8`, with `OOMKilled=false`. A fixed benign diagnostic with `UV_THREADPOOL_SIZE=1` and the same eight-task ceiling exited 0 and reported DNS `EAI_AGAIN`. The preflight now fixes the libuv pool to one thread while retaining the PID, memory, CPU and network limits. Full target-free containment is still pending.

Candidate `e708eaba023fba56b7e47b9598f4da0f748cbc47` then passed both image preflights and reached the two-container helper, which stopped because the sidecar readiness check launched another Node process inside the eight-task sidecar. Readiness now reads the container's `/proc/net/tcp` using fixed `/bin/cat` arguments and requires the exact `127.0.0.1:17777` LISTEN record. The same change applies to the sandbox coordinator; wildcard addresses and non-listening records fail closed. The helper's socket-visibility assertion uses fixed `/usr/bin/test -S`, avoiding a second Node process there as well. PID and other resource limits remain unchanged.

A controlled sidecar diagnostic then showed `running`, exit 0, no OOM, but even the fixed `cat` exec initially failed with `crun: fork: Resource temporarily unavailable`. Repeating with the same eight-task ceiling and fixed `--v8-pool-size=1` allowed the exec to return the exact loopback LISTEN record with exit 0. The trusted sidecar image now fixes V8's worker pool to one thread, reserving capacity for readiness without expanding the PID ceiling. The provider image and accepted first-party runtime image are unchanged.

## Real Oracle target-free containment pass

Exact runtime source: `8472f33c9c2ad04b29e436b07b551ac8ed062ae2`.
Command: `scripts/phase12-provider-containment-bundle.sh httpx linux-amd64`.
Host evidence directory: `/home/scopeforge-worker/phase12-acceptance-20261028/.artifacts/phase12-provider-acceptance/httpx-linux-amd64-8472f33c9c2a`.

Both `PHASE12_PROVIDER_LINUX_CONTAINMENT_PASS` and `PHASE12_PROVIDER_CONTAINMENT_BUNDLE_PASS` were emitted. The six probe facts were all true: `dnsBlocked`, `publicTcpBlocked`, `metadataBlocked`, `loopbackProxy`, `socketAbsent`, and `engineSocketAbsent`.

```text
provider_image=localhost/scopeforge-httpx-worker@sha256:4720435ac38908608984cca8046e974c4bc8dc4d3608c7e65d2d56a0bddb11cc
sidecar_image=localhost/scopeforge-provider-egress-sidecar@sha256:8efca136464e1011a68928f638aed31d47582fe7552bb5d54528667d76bbcc44
provider_staging_sha256=5bdce15096268f6f1ac9a8888ac801431d775d502b197b6424ddc6f5a67f1dab
sidecar_staging_sha256=73df5f06f2f4b6f9a18c473e43012a02ca19a2b316a77841c73d839f06725b4d
provider_preflight_sha256=bbcffea4c79d00f742066fe9871c0f295199c61bee5b09fa174b612ec354a5ec
sidecar_preflight_sha256=0ea484b3b77475833a189435a98b1a05281d9ed5934becba924f19b292604213
containment_sha256=816cc3b5f3b926807770f3c52a4e30716b2aca9a9092d514253e11028c20b00b
```

Post-run checks confirmed a clean source worktree, zero remaining acceptance containers, zero egress sockets, and all three accepted worker services active. The worktree and ignored staging/evidence files remain available for audit. No Phase 11 canary, provider enablement, database mutation, production target authority or worker registration was performed.

This accepts target-free httpx preparation only. Issue #214 still requires an executable real host-tunnel harness, separately reviewed controlled-target authorization, pinned-IP dialing, hostile-frame rejection, budgets, cancellation, resource ceilings with a real provider process, and cleanup evidence before any worker/control-plane integration.

Fresh focused testing on the same Oracle checkout passed all 21 tests in four files: sandbox orchestration (including wrong-address/non-listening readiness denial), host tooling/Bash syntax, Linux containment architecture and executable/thread-budget guards. This resolves the Windows-only verification limitations recorded above without changing any path or security test.
