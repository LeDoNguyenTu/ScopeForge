# Phase 12 real host-tunnel acceptance

Verified 2026-10-30, Asia/Bangkok. Issue #214; PR #220.

## Candidate and authority

- Exact clean runtime/harness source: `fad381480dc1961e4e3fcc606112f37851354f9f`.
- Isolated Oracle worktree: `/home/scopeforge-worker/phase12-host-tunnel-20261030`.
- Node: 24.16.0; dedicated non-root worker, rootless Podman, cgroup v2.
- Owner authorized `ldnt.me`, ScopeForge or a target created specifically for acceptance.
  An isolated fixed-response fixture was created in the verified Vercel team `itsbrian`.
- Final fixture project: `prj_e4oXfUTwCpSltR7aGF4ZgO7g9u3H`, deployment
  `dpl_EDSgQ2CtJ2e2sr6ZWLx7eaYksy8J`; this was separate from production ScopeForge.
- Reviewed exact target: HTTPS, port 443,
  `scopeforge-acceptance-fixture-20261030-d158ykfmz-itsbrian.vercel.app`.
- Complete host DNS answer set: `216.198.79.67`, `64.29.17.67`, both public IPv4.
  The authority and shared policy validated the full set before opening a tunnel.
- Authority file digest:
  `a0b586b2b81f509f163ab3f16f1fe866d9a2a5a0380d5c2e82dcc19f7b652402`.
- Provider image:
  `localhost/scopeforge-httpx-worker@sha256:4720435ac38908608984cca8046e974c4bc8dc4d3608c7e65d2d56a0bddb11cc`.
- Sidecar image:
  `localhost/scopeforge-provider-egress-sidecar@sha256:8efca136464e1011a68928f638aed31d47582fe7552bb5d54528667d76bbcc44`.

The existing provider, sidecar, boundary and sandbox runtime sources are identical
to the prior target-free tested source `8472f33c9c2ad04b29e436b07b551ac8ed062ae2`.
The new host harness composes those modules without weakening them.

## Direct evidence

The host-only acceptance entry returned `result: PASS` for the exact candidate.
Evidence is retained privately in the worktree at
`.artifacts/host-tunnel.evidence.json`; it contains no nonce or raw response body.

| Gate | Observed result |
| --- | --- |
| Real httpx execution | HTTP 200 from the fixed fixture; one host-owned dial to `216.198.79.67:443` |
| Traffic | 1,907 bytes uploaded, 6,015 bytes downloaded; normalized output 468 bytes |
| Hostile frames | Wrong host, port, nonce, literal-IP host and extra fields rejected with zero target dials |
| SOCKS denials | Wrong host/port and IP-literal CONNECT rejected inside the real provider image |
| Network isolation | Provider DNS, direct public TCP and metadata access blocked |
| Capability isolation | Only the trusted sidecar receives the Unix socket/nonce; provider has no bind mounts or engine sockets |
| Connection budget | First dial accepted, next rejected at a one-connection ceiling |
| Upload budget | Two-byte write terminated against a one-byte ceiling, with zero accepted upload bytes |
| Download budget | Actual target TLS bytes observed; none forwarded beyond the one-byte ceiling |
| Deadline | Active transport closed and Unix socket removed on session expiry |
| Cancellation | Real provider aborted with an active pinned target connection; no output accepted |
| Memory/swap | Running provider and sidecar: 268,435,456 bytes maximum, zero swap |
| CPU/PIDs | Running provider: `50000 100000`, PID 32; sidecar: same CPU ceiling, PID 8 |
| Linux capabilities | Effective and bounding masks both zero for both running processes |
| Scratch | 8 MiB noexec/nosuid/nodev tmpfs; fixed diagnostic exceeding it returned ENOSPC |
| Cleanup | Repeated container removal/tunnel closure passed after success and cancellation |

The candidate also passed **44 focused tests on real Oracle Linux**, including three
real Unix/TCP transport regressions. One negative regression proves an empty target
response cannot be mistaken for successful download-budget enforcement. The new
authority tests reject expiry, changed source/digest/images, unreviewed identities,
unknown fields, unsafe/duplicate pins and mixed/private/IPv6 DNS answers.

Independent post-run host checks returned:

A separate supervisor interruption check sent SIGTERM only after observing the
harness process's established target TCP connection. It exited with the expected
failure, removed all acceptance containers/sockets, and the subsequent full run
passed. Both pre-cancelled execution and interruption during active transport have
regression coverage. The evidence for the earlier pre-signal candidate `b9638b11`
and its first temporary fixture remains historical; both fixture projects were
removed after use.

```json
{"remainingAcceptanceContainers":0,"remainingEgressSockets":0,"remainingTargetConnections":0}
```

The original temporary Oracle listener was stopped; port 18080 had no listener.
All three accepted production worker services remained active. The initial local
fixture was not used as passing evidence because Oracle could not hairpin to its
own public NAT address. No host routes or firewall rules were changed.

After verification, the temporary Vercel project and its deployment were deleted
with the authenticated owner CLI after checking the exact project ID. The provider
API confirms the project list is empty and the deployment lookup returns 404.

## Scope and release gate

This is shared boundary acceptance tooling, not operational acceptance or
production enablement of httpx/Nuclei. No worker registration, queue route,
Supabase mutation, production identity change, capability flag, service restart or
Phase 11 canary occurred. Kernel CPU/memory/PID ceilings were sampled with the real
native provider; deliberate native memory/PID/CPU/output exhaustion is not claimed.
Scratch exhaustion and existing output-capture bounds have separate checks.

Exact-head full CI and merge remain release gates for PR #220. The next scope is a
separately reviewed dedicated worker/control-plane design, followed by its own
acceptance, rollback and bounded production-canary authorization. Keep providers
default-off.
