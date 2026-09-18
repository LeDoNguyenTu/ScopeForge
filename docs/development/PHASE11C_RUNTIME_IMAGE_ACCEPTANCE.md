# Phase 11C Runtime Image Candidate

Last reconciled: 2026-09-19, Asia/Singapore.

## Purpose

This source slice makes the existing networkless runtime worker entry reproducibly buildable as an immutable OCI image candidate for the Phase 11 HTTP containment gate.

It does not enable `phase11_http_discovery_v1` in the normal hosted worker runtime.

## Source artifacts

`npm run build:workers` now produces:

- `.scopeforge-worker-build/scopeforge-worker.cjs`
- `.scopeforge-worker-build/hosted-scanner-entry.js`
- `.scopeforge-worker-build/runtime-worker-entry.js`
- `.scopeforge-worker-build/main.wasm.gz`

The runtime image source is:

- `deploy/worker/Containerfile.runtime`

The image contains only the bundled runtime mediator client entry and the reviewed digest-pinned Node base. It uses uid/gid 65532 and has no image-build package installation or network fetch step.

## Build on the accepted Linux worker host

From an exact clean release candidate:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm run build:workers

mkdir -p /var/tmp/scopeforge-phase11-runtime-image
cp .scopeforge-worker-build/runtime-worker-entry.js /var/tmp/scopeforge-phase11-runtime-image/
cp deploy/worker/Containerfile.runtime /var/tmp/scopeforge-phase11-runtime-image/Containerfile

cd /var/tmp/scopeforge-phase11-runtime-image
podman build --network=none -f Containerfile -t localhost/scopeforge-runtime-worker:phase11-candidate .
podman image inspect localhost/scopeforge-runtime-worker:phase11-candidate
```

Record and use only the resulting immutable digest form:

`localhost/scopeforge-runtime-worker@sha256:<digest>`

Do not use the mutable build tag for acceptance execution.

## Containment acceptance

The Phase 6D Task 15 evidence is historical precedent, not acceptance for this rebuilt image. Repeat the affected checks against the exact new source SHA and exact image digest.

At minimum prove:

- rootless Podman and delegated cgroup v2
- exact generated production command starts
- `--pull=never`
- `--network=none`
- read-only root filesystem
- capabilities dropped
- no-new-privileges
- pids limit 8 remains viable for the current pinned Node image
- 256 MiB memory and zero swap
- 0.5 CPU ceiling
- 8 MiB noexec/nosuid/nodev scratch for Phase 11 HTTP
- only the exact mediator Unix socket is mounted
- the socket bind remains read-only and connectable
- direct DNS, public TCP/HTTPS, loopback and unrelated Unix sockets are unavailable from the container
- authorized HTTPS succeeds only through the trusted mediator
- private/link-local/metadata/multicast/reserved target classes fail closed
- same-host redirect reauthorization remains enforced
- cancellation aborts in-flight HTTPS and removes the container before mediator cleanup
- wall-time and output ceilings force termination and cleanup
- no mediator nonce, worker secret, authorization token, URL credential, response body or unrestricted header set appears in logs
- terminal cleanup leaves no container or mediator socket

## Deliberately still disabled

This source slice does not:

- add `phase11_http_discovery_v1` to `packages/worker-runtime/config.ts`
- add a production worker environment variable for the runtime image
- apply any Phase 11 or Phase 11C migration
- register a production Phase 11 worker node
- enable a hosted feature flag
- enable Nmap, Nuclei or external httpx process execution

The normal long-running worker must remain unable to select the Phase 11 HTTP class until the exact image passes real Linux containment acceptance and a separate enablement review authorizes the configuration change.
