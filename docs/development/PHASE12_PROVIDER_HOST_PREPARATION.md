# Phase 12 external provider host preparation

Status: source helper only - no production provider is enabled by this procedure.

## Purpose

Prepare and verify immutable Phase 12 provider image candidates without manually copying unverified binaries or templates.

This procedure applies to the currently reviewed external-provider runtime images:

- ProjectDiscovery httpx v1.12.0
- ProjectDiscovery Nuclei v3.11.1 with the single reviewed Nuclei template allowlist
- the ScopeForge trusted networkless egress sidecar

It does not register a worker, create a production task, modify Supabase, grant target authority, or authorize external scanning.

## Preconditions

Use a clean checkout of the exact candidate SHA on the dedicated Linux worker host.

Required host tools:

- Node 24
- npm
- curl
- git
- sha256sum
- unzip
- rootless Podman
- unified cgroup v2

Run under the dedicated non-root worker account. Do not run the acceptance helper as root.


## One-command target-free preparation

For the normal 12A or 12B host-preparation pass, prefer the coordinator so the
staging, immutable-image identities, preflight output and containment evidence
stay tied to one exact source SHA:

```bash
scripts/phase12-provider-containment-bundle.sh httpx linux-amd64
```

Repeat separately with `nuclei` for 12B.

The coordinator:

- starts only from a clean exact source checkout
- installs dependencies with lifecycle scripts disabled and rebuilds the worker bundles
- stages the checksum-pinned provider artifact and the locally built trusted sidecar
- runs both networkless immutable-image preflights
- extracts and validates the resulting image digest references
- runs the target-free two-container containment helper
- writes a compact evidence bundle under `.artifacts/phase12-provider-acceptance/`
- leaves the generated build contexts under the ignored `.scopeforge-provider-build/` tree so they do not invalidate the containment helper's clean-checkout gate

It still does not contact an authorized target, register a worker, mutate
Supabase, create a queue route, or enable a provider. A successful bundle is
preparation and containment evidence only.

The manual sequence below remains useful for diagnosis and independent reruns.

## 1. Build worker bundles

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run build:workers
```

## 2. Stage reviewed artifacts

For httpx:

```bash
scripts/phase12-stage-provider-assets.sh httpx linux-amd64
```

For Nuclei:

```bash
scripts/phase12-stage-provider-assets.sh nuclei linux-amd64
```

For the trusted egress sidecar:

```bash
scripts/phase12-stage-egress-sidecar.sh
```

The external-provider staging helper:

- reads the committed provider artifact manifest
- permits only the reviewed ProjectDiscovery GitHub release URL family
- verifies the release archive SHA-256 before extracting anything
- extracts only the expected root binary
- never executes the downloaded provider
- for Nuclei, downloads the one allowlisted template from the exact pinned template commit and verifies its Git blob identity
- refuses to overwrite an existing staging directory
- emits a compact `STAGING_EVIDENCE.txt`

Treat a checksum/blob mismatch as a hard stop. Do not bypass it by updating the expected value on the host.

The sidecar staging helper performs no download. It copies only the exact locally built ScopeForge sidecar bundle and the digest-pinned sidecar Containerfile into a fresh context and records their SHA-256 values.

## 3. Run the networkless image preflight

```bash
scripts/phase12-provider-host-preflight.sh httpx .scopeforge-provider-build/httpx-linux-amd64
scripts/phase12-provider-host-preflight.sh nuclei .scopeforge-provider-build/nuclei-linux-amd64
scripts/phase12-provider-host-preflight.sh egress-sidecar .scopeforge-provider-build/egress-sidecar
```

The helper builds with `--network=none --pull=never`, derives the immutable local image digest, then verifies:

- rootless Podman
- cgroup v2
- reviewed provider version
- networkless execution
- read-only root filesystem
- all capabilities dropped
- no-new-privileges
- PID, memory, swap, CPU and scratch ceilings

Successful output ends with:

```text
PHASE12_PROVIDER_HOST_PREFLIGHT_PASS
```

Record the exact source SHA, staging evidence and immutable image reference for all three candidates. The sidecar image contains no external provider binary.

## What this does not prove

This preflight intentionally keeps provider containers networkless. It does not prove target-bound provider egress and therefore does not authorize production scanning.

Before 12A httpx or 12B Nuclei may become runtime-enabled, ScopeForge still needs a dedicated reviewed network boundary that proves:

1. the external provider cannot contact arbitrary Internet destinations
2. only the currently authorized target host/IP/port can be reached
3. DNS and redirect behavior cannot widen authority
4. connection/request/runtime/output budgets are enforced outside the provider
5. cancellation kills the provider process tree and removes all runtime state
6. worker identity, queue and control-plane routes are execution-class scoped
7. rollback disables only the new provider class
8. a separately authorized bounded production canary passes

Do not substitute ordinary Podman Internet networking for this gate.


## Target-free two-container Linux containment

After immutable httpx/Nuclei and provider-egress-sidecar images have been built and retained locally by digest, run:

```bash
scripts/phase12-provider-linux-containment.sh \
  httpx \
  localhost/scopeforge-httpx-worker@sha256:<digest> \
  localhost/scopeforge-provider-egress-sidecar@sha256:<digest>
```

Repeat separately for Nuclei with its own immutable provider image.

The helper is intentionally target-free. It requires a clean exact source SHA, non-root/rootless Podman, cgroup v2 and locally available immutable images. It creates a supervisor-owned Unix-socket fixture, starts the trusted sidecar with `--network=none`, starts a fixed Node containment probe from the provider image in the sidecar network namespace, and fails unless direct DNS, public TCP and link-local metadata access are blocked while `127.0.0.1:17777` remains reachable. It also fails if the provider can see the task Unix socket or common container-engine sockets.

A pass is containment evidence only. It does not prove real target dialing, host mediator pinned-IP behavior, byte budgets, cancellation under a real provider process, or production authorization. Those remain required before worker/control-plane integration or a production canary.
