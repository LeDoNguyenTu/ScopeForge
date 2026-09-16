# Phase 10A2 Worker Operations

This runbook covers the dedicated production worker processes required by private repository acquisition and the follow-on zero-egress repository scan. It contains no credentials or signed capability URLs.

## Runtime artifacts

Run from a clean exact candidate with Node 24:

```text
npm ci
npm run build:workers
```

The untracked `.scopeforge-worker-build/` directory contains:

- `scopeforge-worker.cjs` - the long-running broker client and supervisor process
- `lib/hosted-scanner-entry.js` - the fixed entrypoint for the zero-egress scanner image
- `main.wasm.gz` - the pinned HCL parser runtime asset required by the scanner entrypoint

The build uses the repository-pinned `esbuild` version and targets Node 24. The worker bundle validates every broker response before the supervisor consumes it. It accepts only an exact HTTPS control-plane origin, canonical worker identity, 64-character credential, fixed execution class, fixed execution budget, bounded JSON response, and class-specific task input.

## Host boundary

Use the dedicated `scopeforge-worker` Linux account on the accepted rootless-Podman/cgroup-v2 host. Install the verified Node 24 distribution under `/opt/scopeforge/node` and deploy the worker bundle under `/opt/scopeforge/current`.

The systemd unit provisions `/run/scopeforge-worker` with `RuntimeDirectory=scopeforge-worker` and mode `0700`, then exposes it as `XDG_RUNTIME_DIR`. Do not hardcode or depend on a numeric Linux UID or `/run/user/<uid>` path in the service definition. This keeps the deployment portable when the dedicated `scopeforge-worker` account receives a different UID on a rebuilt or replacement host.

Store one root-owned mode-`0600` environment file per worker under `/etc/scopeforge/workers/`. Required common names:

- `SCOPEFORGE_WORKER_BASE_URL`
- `SCOPEFORGE_WORKER_ID`
- `SCOPEFORGE_WORKER_SECRET`
- `SCOPEFORGE_WORKER_EXECUTION_CLASS`
- optional `SCOPEFORGE_WORKER_POLL_MS`

The private acquisition worker uses only execution class `repository_snapshot_github_private_v1` and receives no GitHub App credential, installation token, Supabase credential, or R2 long-lived credential.

The repository scan worker uses only execution class `phase3_repository_scan_no_egress_v1` and additionally requires:

- `SCOPEFORGE_REPOSITORY_SCAN_WORK_ROOT`
- `SCOPEFORGE_R2_DOWNLOAD_HOST`
- `SCOPEFORGE_PODMAN_BINARY`
- `SCOPEFORGE_SCANNER_IMAGE` as an immutable local image digest

The scan worker receives only a temporary attempt-scoped R2 GET. The scanner container runs with the existing fixed `--network=none`, read-only root/input mounts, dropped capabilities, no-new-privileges, CPU/memory/PID/scratch/output ceilings, and forced cleanup behavior.

## Scanner image

Stage `lib/hosted-scanner-entry.js`, `main.wasm.gz`, and `deploy/worker/Containerfile.scanner` in a private host build directory. The scanner bundle contains its JavaScript dependencies. Its `lib/` location preserves the HCL parser's expected path to the separate WASM asset one directory above it. The container source pins the accepted Node 24.16.0 base by registry digest. Build locally as the worker account, inspect the resulting digest, and set only the immutable result digest in the scan worker environment.

Do not publish this operational image to a public registry. Do not use a mutable tag in the worker environment.

## Service lifecycle

Install `deploy/worker/scopeforge-worker@.service` as `/etc/systemd/system/scopeforge-worker@.service`, then enable the two class-specific instances only after their database identities and environment files exist.

Safe startup order:

1. keep all Vercel repository runtime gates false or absent
2. start workers and verify idle authenticated claims
3. deploy the exact application candidate
4. enable the three repository gates only for the bounded canary window
5. run one private repository snapshot and its automatic zero-egress scan
6. inspect bounded worker/application logs and persisted provenance
7. keep the gates enabled only after acceptance passes

## Rollback

At the first authorization, containment, publication, leakage, or cleanup failure:

1. set the three hosted repository runtime gates false
2. redeploy the control plane so the false values take effect
3. stop both worker services
4. allow lease recovery to mark any unfinished attempt terminal
5. inspect privacy-reduced worker events and application telemetry
6. disable the affected worker node in the database if its credential or host integrity is in doubt

Never place worker credentials in Git, Vercel, browser state, issue/PR comments, ordinary logs, or this runbook.
