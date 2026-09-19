# Phase 11C Runtime Image Candidate

Last reconciled: 2026-09-19, Asia/Singapore.

## Purpose

This source slice makes the networkless runtime worker entry reproducibly buildable as an immutable OCI image for the Phase 11 HTTP containment boundary.

The exact image has passed real Linux rootless-Podman/cgroup-v2 acceptance. PR #147 subsequently released explicit worker-host configuration for `phase11_http_discovery_v1`.

## Source artifacts

`npm run build:workers` produces:

- `.scopeforge-worker-build/scopeforge-worker.cjs`
- `.scopeforge-worker-build/hosted-scanner-entry.js`
- `.scopeforge-worker-build/runtime-worker-entry.js`
- `.scopeforge-worker-build/main.wasm.gz`

Runtime image source:

- `deploy/worker/Containerfile.runtime`

The image contains the bundled runtime worker entry and reviewed digest-pinned Node base, uses uid/gid 65532, and performs no image-build package installation/network fetch.

## Accepted immutable image

`localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`

Runtime bundle SHA-256:

`05dd6f00bb5a1bf9be6b8046d3c7aeff79b4b78a7b73dba5d72acb095cee8153`

Do not substitute a mutable tag or a newly rebuilt image without repeating the affected containment acceptance.

## Acceptance evidence

The accepted image proved:

- rootless Podman and delegated cgroup v2
- production command generation with `--pull=never`
- `--network=none`
- read-only root filesystem
- capability drop and no-new-privileges
- pids ceiling 8
- 256 MiB memory and zero swap
- 0.5 CPU ceiling
- 8 MiB noexec/nosuid/nodev scratch
- exact mediator Unix socket only
- direct DNS/public TCP/HTTPS/loopback denial
- real authorized HTTPS only through the trusted mediator
- cross-host redirect rejection
- cancellation cleanup
- wall-time cleanup
- output ceiling cleanup
- clean terminal state with no remaining container or mediator socket

See `PHASE11C_LINUX_ACCEPTANCE.md` for the exact host evidence.

## Current production state

- Production Phase 11A/11C migrations are already applied.
- A `phase11_http_discovery_v1` worker identity is already registered for current `main`.
- The registered worker has not heartbeated yet.
- No Phase 11 HTTP worker task has run.
- Vercel production is READY on current `main`.
- The remaining gate is host-side worker start, idle authentication proof, rollback proof, and one bounded authorized canary.

See `PHASE11C_PRODUCTION_ENABLEMENT.md` for the operational release procedure.
