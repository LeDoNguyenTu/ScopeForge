# Phase 12 host script permissions

On 2026-10-28, read-only checks of the accepted Oracle host confirmed the dedicated worker service uses Node 24.16.0, rootless Podman is available, cgroup v2 is active, and the exact pinned Node base image is present.

An isolated detached worktree was created at `/home/scopeforge-worker/phase12-acceptance-20261028` for source `9324dd177bd75b060b197416f3025eb10d28c194`. Invoking `scripts/phase12-provider-containment-bundle.sh httpx linux-amd64` stopped immediately with `Permission denied`. No provider staging, containment run, worker registration, database mutation or provider enablement occurred.

Git records the coordinator and Linux containment helper as mode `100644`; both require `100755` because the documented procedure and coordinator invoke them directly. The other three invoked helpers already have executable mode. This patch corrects the two modes and adds a portable Git-index regression check covering all five helpers.

The new guard failed before correction and passed afterward. Eleven focused host-tooling tests passed; the existing Bash syntax check failed on Windows because it passes a Windows path to Bash. Linux CI and the real host run remain required; no test or containment control was weakened.

The first corrected host attempt then stopped because `unzip` was absent. Ubuntu package `unzip=6.0-28ubuntu4.1` was installed after a simulation confirmed one new package with no upgrade or removal. The coordinator now checks `curl` and `unzip` before installing dependencies or building. No worker service or container restart was required.

The immutable httpx candidate built as `localhost/scopeforge-httpx-worker@sha256:4720435ac38908608984cca8046e974c4bc8dc4d3608c7e65d2d56a0bddb11cc`. Its Node DNS preflight exited 139 under `--pids-limit=8`, with `OOMKilled=false`. A fixed benign diagnostic with `UV_THREADPOOL_SIZE=1` and the same eight-task ceiling exited 0 and reported DNS `EAI_AGAIN`. The preflight now fixes the libuv pool to one thread while retaining the PID, memory, CPU and network limits. Full target-free containment is still pending.
