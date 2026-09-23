# Phase 12 current state

Last reconciled: 2026-09-23, Asia/Singapore.

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
