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
4. The provider container stays `--network=none`. It sees only loopback plus one task-specific read-only Unix mediator socket.
5. A ScopeForge-owned loopback SOCKS5 shim listens only on `127.0.0.1:17777` inside the provider container.
6. The provider receives a fixed internal proxy argument. Callers cannot supply or override it:
   - httpx: `-http-proxy socks5://127.0.0.1:17777`
   - Nuclei: `-proxy socks5://127.0.0.1:17777`
7. The SOCKS5 shim permits only CONNECT using the exact authoritative hostname and port. Literal-IP SOCKS requests are rejected.
8. The shim asks the supervisor-owned Unix mediator for a tunnel using a bounded task/session nonce. The request contains no arbitrary URL or destination IP.
9. The host mediator validates the same hostname and port again, selects only from the pinned address set, then owns the real TCP connection.
10. Host-side connection count, upload bytes, download bytes and deadline are enforced independently of the provider process.
11. Cancellation closes provider execution, loopback proxy state, Unix tunnel state and the host TCP connection.
12. Redirects remain disabled in both initial provider profiles. A redirect response therefore cannot widen authority.

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
- only loopback SOCKS5 is reachable inside the container
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
- `packages/provider-egress-boundary/loopback-socks5.ts` owns the provider-container loopback SOCKS5 listener
- `packages/provider-egress-boundary/tunnel-protocol.ts` defines the single bounded connect frame and one-byte acceptance signal

The host socket root is `/run/scopeforge-worker/egress`, which keeps a 64-hex task socket name within Linux `sockaddr_un` limits. The container sees only `/run/scopeforge/egress.sock`.

The host side performs no DNS lookup. It receives only the exact hostname/port plus task nonce in the bounded frame, revalidates those through the task authorizer, selects an already validated pinned IPv4 address, and calls `net.createConnection` with that literal address and IPv4 family.

Both halves reject pre-authorization pipelined application bytes. This keeps request payload forwarding behind successful SOCKS authorization plus host tunnel authorization.

This implementation remains source-only until the actual provider images include the loopback shim and Linux acceptance proves the full process, socket, network and cleanup boundary.
