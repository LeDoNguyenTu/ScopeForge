# Phase 12 target-bound external provider egress

Status: source boundary foundation only. External httpx and Nuclei remain default-off.

## Objective

Give reviewed external provider binaries enough connectivity to reach one currently authorized target without ever giving their container ordinary Internet access.

The provider container remains under the accepted ScopeForge sandbox posture:

- rootless Podman
- immutable image digest
- `--network=none`
- read-only root filesystem
- all Linux capabilities dropped
- no-new-privileges
- fixed PID, memory, CPU, scratch, wall-time and output ceilings
- no Docker/Podman socket
- no host network namespace
- no generic URL, resolver, proxy or provider-native flag surface

## Boundary shape

The Phase 12 boundary is intentionally provider-neutral.

1. The trusted supervisor reauthorizes the exact target node and derives one hostname, one scheme and one port.
2. Trusted host DNS resolution is performed outside the provider container. The complete raw answer set is passed into the boundary without prefiltering.
3. The shared network-safety policy validates the entire answer set first. The initial provider profile then requires a small IPv4-only pinned set of at most four addresses and rejects private, loopback, link-local, carrier-grade NAT, documentation, multicast and reserved ranges. Any IPv6 answer makes the initial profile fail closed until IPv6 is separately reviewed.
4. A trusted ScopeForge egress sidecar starts with `--network=none` and is the only container that receives the task-specific Unix tunnel socket plus task nonce.
5. The external provider container joins only the sidecar's network namespace. It does not receive the Unix socket, target IP set, session nonce, host credentials, or ordinary rootless-Podman Internet networking.
6. The ScopeForge-owned sidecar listens only on `127.0.0.1:17777`. The provider therefore sees only the loopback SOCKS5 endpoint in the shared networkless namespace.
7. The provider receives a fixed internal proxy argument. Callers cannot supply or override it:
   - httpx: `-http-proxy socks5://127.0.0.1:17777`
   - Nuclei: `-proxy socks5://127.0.0.1:17777`
8. The SOCKS5 shim permits only CONNECT using the exact authoritative hostname and port. Literal-IP SOCKS requests are rejected.
9. The shim asks the supervisor-owned Unix mediator for a tunnel using a bounded task/session nonce. The request contains no arbitrary URL or destination IP.
10. The host mediator validates the same hostname and port again, selects only from the pinned address set, then owns the real TCP connection.
11. Host-side connection count, upload bytes, download bytes and deadline are enforced independently of the provider process.
12. Cancellation closes provider execution, sidecar proxy state, Unix tunnel state and the host TCP connection.
13. Redirects remain disabled in both initial provider profiles. A redirect response therefore cannot widen authority.

## Source foundation

The first source boundary is in `packages/provider-egress-boundary`.

It provides:

- canonical exact-target policy creation
- public IPv4 pin validation through the shared `packages/network-safety` policy
- closed resource ceilings
- fixed provider proxy arguments
- SOCKS5 greeting parsing
- exact-host/port CONNECT validation
- rejection of IP-literal SOCKS destinations
- nonce-bound host authorization
- deterministic selection only from the pinned address set
- host-side connection/byte/deadline accounting
- rejection of unknown frame fields

This source does not yet create a production worker, open a real target socket, change Supabase, or enable either provider.

## Why ordinary rootless Podman networking is rejected

Rootless slirp/pasta networking would still give the provider a general network path. Provider flags and application-layer validation are not a sufficient egress boundary because a compromised or unexpected provider binary could make unrelated connections.

The production design therefore keeps `--network=none` and moves the only real target connection into ScopeForge-owned host code.

## Linux acceptance requirements

Before this boundary may be integrated into a worker class, real Oracle/Linux evidence must prove:

- direct provider DNS fails
- direct provider public TCP/HTTPS fails
- host and metadata endpoints are unreachable
- only loopback SOCKS5 is reachable from the provider container
- the provider container cannot see or connect to the host Unix tunnel socket
- only the trusted sidecar can see the task nonce and Unix tunnel mount
- cross-host and wrong-port SOCKS5 requests fail closed
- IP-literal SOCKS5 requests fail closed
- the host tunnel dials only an address from the prepared pinned set
- connection, upload, download and wall-time ceilings terminate the tunnel
- provider cancellation removes the container, loopback listener, Unix socket and target TCP connection
- no unrelated Unix socket is visible
- no network namespace, container-engine socket or host credential is exposed
- immutable provider image identity and exact source SHA are recorded

## Integration ordering

Do not add a worker identity, queue route or database migration until the host tunnel implementation and Linux containment checks pass.

After that review:

1. wire 12A httpx to the fixed loopback proxy
2. run source and Linux acceptance
3. add the dedicated class-scoped control-plane path
4. verify idle claims and rollback
5. run one separately authorized bounded production canary
6. repeat the same containment path for 12B Nuclei while preserving its single-template allowlist

A source-only or default-off implementation is not operational acceptance.


## Source transport implementation

The follow-on source transport implements the two sides of the networkless bridge:

- `packages/provider-egress-boundary/unix-tunnel.ts` owns the host Unix listener, target TCP connection and independent byte/deadline accounting
- `packages/provider-egress-boundary/loopback-socks5.ts` owns the trusted egress-sidecar loopback SOCKS5 listener
- `packages/provider-egress-boundary/tunnel-protocol.ts` defines the single bounded connect frame and one-byte acceptance signal

The host socket root is `/run/scopeforge-worker/egress`, which keeps a 64-hex task socket name within Linux `sockaddr_un` limits. Only the trusted sidecar sees `/run/scopeforge/egress.sock`; the external provider container must not mount that path.

The host side performs no DNS lookup. It receives only the exact hostname/port plus task nonce in the bounded frame, revalidates those through the task authorizer, selects an already validated pinned IPv4 address, and calls `net.createConnection` with that literal address and IPv4 family.

Both halves reject pre-authorization pipelined application bytes. This keeps request payload forwarding behind successful SOCKS authorization plus host tunnel authorization.

This implementation remains source-only until a dedicated sidecar entry/image and provider sandbox orchestration are wired and Linux acceptance proves the two-container network namespace, socket isolation, process limits and cleanup boundary.


## Sidecar source integration

The provider-side source integration is deliberately split from the external provider images:

- `packages/provider-egress-sidecar` accepts only the canonical target hostname, one port and one 64-hex task nonce
- `deploy/worker/Containerfile.provider-egress-sidecar` contains only the pinned Node base and the ScopeForge sidecar entry
- neither httpx nor Nuclei is copied into the sidecar image
- both provider execution plans hardwire their proxy to `socks5://127.0.0.1:17777`
- callers still have no proxy argument, URL override, redirect expansion or native provider flag surface
- host preparation stages and networklessly preflights the sidecar separately from provider artifacts

The next sandbox layer must start the sidecar with `--network=none`, mount the task Unix socket only into that sidecar, then start the provider container in the sidecar network namespace without mounting the Unix socket or passing the nonce.


## Provider sandbox orchestration source

The next default-off source layer is now implemented in `packages/provider-runtime-sandbox`.

It deliberately does not create a worker identity, queue route, database migration, capability enablement, or production canary. The sandbox plan:

- validates immutable digest references for both provider and sidecar images
- validates the task-specific egress socket is under `/run/scopeforge-worker/egress`
- starts the trusted sidecar with `--network=none`
- mounts the task Unix socket read-only only into that sidecar
- gives the task nonce only to that sidecar
- starts the provider with `--network=container:<sidecar>`, which shares only the sidecar's otherwise networkless namespace
- does not mount the Unix socket or pass the nonce to the provider
- constructs the exact httpx or baseline Nuclei runner arguments from typed fields, with no generic provider-flag array
- preserves read-only rootfs, capability drop, no-new-privileges, cgroup memory/CPU/PID ceilings, no log driver, fixed uid/gid, cleared environment and noexec scratch
- uses a fixed loopback-only readiness probe before starting the provider
- force-removes provider then sidecar on completion, error or cancellation

This remains source preparation until exact-head CI and real Linux/Oracle two-container acceptance prove the namespace, socket isolation, immutable image identities, process/resource ceilings, cancellation and cleanup behavior.
