# Phase 12 current state

Last reconciled: 2026-09-24, Asia/Singapore.

## Baseline

- Approved ScopeForge v1 roadmap: 100%.
- Phase 11 source/operational acceptance: 100%.
- Broader automated-pentest product vision: approximately 75% at Phase 12 start.
- Production external-provider execution remains disabled until each provider passes its own operational gate.

## 12A external ProjectDiscovery httpx

Source/runtime preparation is substantially complete and remains default-off.

Released through PR #185:

- pinned ProjectDiscovery httpx v1.12.0 Linux artifact SHA-256 values
- closed `web.http.probe.v1` provider contract
- deterministic fixed argument profile
- dedicated worker runner/container entry
- digest-pinned Node container source
- target binding, output bounds, cancellation plumbing, hostile-output checks, privacy-reduced evidence
- worker bundle generation

Remaining 12A gate:

1. build the exact httpx image on the accepted Linux worker host
2. record its immutable image digest
3. prove a target-bound egress design that does not create generic scanner Internet authority
4. prove process-tree cancellation and CPU/memory/PID/disk/runtime/output ceilings
5. register/enable a dedicated worker class only after the database/control-plane design is reviewed
6. run exact-head CI and a separately authorized bounded production canary
7. record rollback and cleanup evidence

No production httpx worker is currently enabled.

Host preparation shipped in PR #193 through `scripts/phase12-stage-provider-assets.sh` and `scripts/phase12-provider-host-preflight.sh`. These helpers verify pinned artifacts and build/check networkless candidate images only. The dedicated target-bound egress source foundation is now being implemented separately in `packages/provider-egress-boundary`; it preserves `--network=none` and mediates only the exact authorized hostname/port through a fixed loopback SOCKS5 boundary. See `PHASE12_PROVIDER_HOST_PREPARATION.md` and `PHASE12_TARGET_BOUND_EGRESS_DESIGN.md`.

## 12B Nuclei safe-active runtime

Source preparation is now in progress on the Phase 12 provider-runtime branch.

Pinned supply-chain identities:

- Nuclei engine v3.11.1
- engine commit `a8c88feb4a1c8e961b7902534ce3af97e9d524a4`
- Linux amd64 SHA-256 `ea63d4ae232808cd7c6bc00d0142428e231fab59dae01042246097d195835ab6`
- Linux arm64 SHA-256 `8044e3d9768ba0a744b2872c1a87e813006f013da97ca9f50f7661a4203bec07`
- nuclei-templates v10.4.7
- templates commit `83234ce456da3e90dda86dfbc5e605e64a846df3`

The first runtime allowlist contains exactly one reviewed non-destructive template:

- `http-missing-security-headers`
- source path `http/misconfiguration/http-missing-security-headers.yaml`
- pinned Git blob `7c1c5b8191ddf3468348b8f8a046b4d61b75d319`
- upstream metadata declares one request

The runtime profile:

- accepts only the exact trusted host/scheme/port
- disables redirects, OAST/interactsh, internal httpx probing and update checks
- uses one template, one host, one request-per-second rate, bulk/concurrency/payload concurrency of one
- omits raw request/response and embedded template material from JSONL output
- normalizes only bounded template/severity/matcher/timestamp evidence
- keeps the more aggressive `misconfiguration-reviewed` and `known-cve-reviewed` profiles disabled

This is source preparation only. No Nuclei production execution is authorized by these files.

The same host preparation helpers stage the pinned Nuclei engine and exact allowlisted template with archive SHA-256 and template Git-blob verification before building a networkless image candidate. Nuclei is intended to reuse the same provider-neutral target-bound egress boundary as httpx, with its one-template allowlist unchanged.

## Storage state

Production Supabase database size observed at Phase 12 start: approximately 18 MB.

Supabase Storage objects: 0.

Production repository snapshot metadata records five R2-backed snapshots. R2 is the large/unstructured artifact plane; Postgres remains the structured system of record.

Phase 12 should continue moving large raw provider evidence/artifacts to private R2 rather than growing Postgres with blob-like payloads.


## 2026-09-24 sandbox orchestration continuation

PR #198 merged as `c9b6509506f2a12f8848ddcab5f4ee5eebe19c15` after exact-head CI run `35919874883` passed. It added the dedicated trusted egress sidecar image/entry, separate no-download sidecar staging, fixed internal proxy arguments for httpx and Nuclei, and extended networkless image preflight. Both providers remain default-off.

PR #199 merged as `a75ff01bc1f6ab7b5214bb8b90eba56b6f9b0bf0` after exact-head CI run `35935363334` passed the full validation gate. The merged provider sandbox gives the egress Unix socket and task nonce only to the networkless trusted sidecar; the provider joins only that sidecar's network namespace and receives neither. Runner arguments are constructed from closed typed httpx/Nuclei profiles rather than an arbitrary flag list. No worker identity, queue route, migration or production enablement was added.

PR #200 merged as `c9ae240224356a4ef81950014891a9b696a5fa8b` after exact-head CI run `35936024843` passed the full validation gate. The target-free Linux containment helper is now released at `scripts/phase12-provider-linux-containment.sh`. It requires a clean exact source SHA, rootless Podman, cgroup v2, and local immutable provider/sidecar image digests. It is designed to prove direct DNS/public TCP/metadata access are blocked, the fixed loopback proxy is reachable, the provider cannot see the task Unix socket or container-engine sockets, and the provider shares only the trusted sidecar network namespace. It does not run httpx/Nuclei scanning or contact a production target.

Operational state remains unchanged until this helper is run successfully on the dedicated Linux/Oracle worker host and the remaining host-tunnel/cancellation/budget acceptance gates pass. 12A and 12B are not operationally accepted.


### Live control-plane verification after PR #199

- Supabase worker execution-class constraints still contain no Phase 12 provider class.
- Phase 11 HTTP tasks are 2 completed and 3 preserved dead-letter, with no queued, leased or retry-wait Phase 11 HTTP task.
- One unrelated public repository snapshot task remains queued and is intentionally untouched.
- The private worker schema currently grants no table privileges to `anon` or `authenticated`. Supabase still reports its generic RLS-disabled advisory for nine private worker tables, so any RLS change remains a separately reviewed control-plane migration rather than an automatic Phase 12 change.


### Current external blocker

Repository preparation for the first two-container Linux containment run is complete. The remaining next action requires access to the dedicated accepted Linux/Oracle worker host and locally built immutable httpx plus provider-egress-sidecar image digests. No qualifying host session was available during the 2026-09-24 repository continuation, so no containment pass is claimed and no provider worker/control-plane/database enablement was attempted.


## Frontend/runtime visibility continuation

Phase 12 now treats frontend parity as part of product completion rather than optional presentation work.

Current implementation on `feat/phase-12-frontend-runtime-visibility-20260924` adds:

- workspace `/dashboard/security-runs` using the existing RLS-safe run summary read model
- per-run `/dashboard/security-runs/[runId]` for action state, coverage, graph counts and normalized observations
- platform-admin `/admin/providers` showing operational versus validation-only providers and each acceptance gate
- a single provider-readiness presentation model derived from the actual provider identifiers/versions
- navigation and dashboard next-action integration
- preview-only `/preview/security-runs` and `/preview/admin?view=providers` surfaces
- mobile/desktop overflow and browser-smoke coverage

The UI intentionally provides no provider enable button. httpx and Nuclei remain visibly disabled until their Linux containment, worker/control-plane and production canary gates actually pass.


Exact-head full CI and rendered browser acceptance are required before this frontend-runtime visibility work may merge.
