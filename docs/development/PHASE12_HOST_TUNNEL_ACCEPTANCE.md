# Phase 12 host-tunnel acceptance harness

Acceptance tooling only, issue #214. It does not enable a provider, register a
worker, mutate Supabase, enqueue work or run a production canary.

The approved design is `PHASE12_TARGET_BOUND_EGRESS_DESIGN.md` and issue #214.
The implementation composes the existing host tunnel and two-container sandbox;
it does not replace their policy or transport enforcement.

## Reviewed authority

Successful target contact requires a separately reviewed JSON authority file and
the SHA-256 of its exact bytes, supplied out of band. The digest prevents accidental
substitution; it is not a cryptographic reviewer signature. Only the authorized
operator may invoke the host entry. The initial harness requires a controlled
HTTP or HTTPS fixture, never an arbitrary production scan target. Example schema (all
placeholders must be replaced after review, and image references must be immutable):

```json
{
  "schemaVersion": 1,
  "purpose": "phase12-controlled-acceptance",
  "reviewedBy": "LeDoNguyenTu",
  "authorizationId": "phase12-acceptance:controlled-fixture",
  "sourceSha": "EXACT_CLEAN_SOURCE_SHA",
  "providerImage": "IMMUTABLE_PROVIDER_REFERENCE",
  "sidecarImage": "IMMUTABLE_SIDECAR_REFERENCE",
  "expiresAt": "SHORT_REVIEWED_EXPIRY",
  "target": { "hostname": "REVIEWED_HOST", "scheme": "http", "port": 18080 },
  "approvedIpv4Addresses": ["REVIEWED_PUBLIC_IPV4"]
}
```

All keys are closed. The authority binds the exact clean source, images, target,
full approved public IPv4 set and expiry (at most 24 hours). Host DNS uses all
answers without prefiltering. Mixed private/IPv6 answers, duplicates and any drift
from the reviewed address set fail before the tunnel starts.

## Execution plan and fixture contract

1. Run the existing target-free containment bundle first if the provider/sidecar
   runtime has changed. Preserve its immutable references and evidence.
2. Use an isolated clean exact-source checkout as the non-root accepted worker
   account, Node 24, rootless Podman and cgroup v2. Build `npm run build:workers`.
3. Start a separately authorized controlled fixture at the exact reviewed
   hostname/port. It must serve only a fixed HTTP 200 response, wait at least
   500 ms before responding, hold idle TCP connections for at least two seconds,
   cap input/requests, and expire automatically. It must contain no
   production data, credentials or state-changing routes.
4. Invoke the host-only entry from the checkout root:

   `node .scopeforge-worker-build/provider-host-acceptance.cjs /private/authority.json REVIEWED_SHA256`

5. Verify the bounded JSON evidence and independently verify the fixture and all
   acceptance containers/sockets have been removed. Stop the fixture even if
   acceptance fails. Existing production services and runtime remain unchanged.

The runner first establishes a real httpx 200 result, then tests hostile frames,
connection count, upload/download budgets, deadline and cancellation. It finally
cancels a real provider with an active host target connection. Resource snapshots
come from the actual running provider and sidecar cgroups: 256 MiB memory, zero
swap, 0.5 CPU, PID caps 32 and 8 respectively. Inspection verifies the read-only
root, UID, capabilities, no-new-privileges, private socket mount and 8 MiB
noexec/nosuid/nodev scratch. A fixed diagnostic inside the provider image tests
DNS/public/metadata denial, wrong-host/port/IP-literal SOCKS denial and socket
absence. It cannot receive arbitrary commands or provider-native flags.
The diagnostic also attempts to exceed the 8 MiB scratch filesystem and requires
`ENOSPC`; the partial file is removed before the real provider starts.

Cleanup always attempts every container removal, repeats removals and tunnel
closure, checks absence, and destroys active host TCP connections. Evidence
includes source, images, reviewed authority digest, target pins, traffic counters,
cgroup snapshots and cleanup facts. It excludes nonce, raw response/provider
output, full container inspection and arbitrary subprocess errors.

## Acceptance limits

The real provider's kernel CPU/memory/PID ceilings are read directly while it is
running. This does not claim deliberate CPU/memory/PID/output exhaustion by the
native binary. Scratch exhaustion is checked by the fixed diagnostic; output
remains subject to the existing externally enforced 32 KiB capture limit. A source
test or local fixture is not external-provider operational acceptance. No Phase 12
execution class, queue/database integration or production canary is authorized by
this harness. Keep httpx and Nuclei default-off.
