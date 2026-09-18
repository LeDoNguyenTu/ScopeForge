# Phase 11C HTTP Discovery Runtime Status

Last reconciled: 2026-09-18, Asia/Singapore. Live repository/provider state wins if newer.

## Baseline

- PR #139 released the default-off external provider contracts.
- This branch is stacked from the exact PR #139 release-candidate head and should be compared against current `main` before merge.
- No Phase 11 production migration is applied.
- No Phase 11 external provider feature flag is enabled.

## Implemented in this slice

The first-party HTTP discovery provider now has a trusted runtime foundation built on the existing Phase 6D mediator pattern.

### Transport

- Trusted runtime HTTPS plans allow only `GET` and `HEAD`.
- HTTPS remains mandatory.
- Port 443 remains mandatory.
- URL credentials and fragments remain rejected.
- DNS resolution is revalidated and pinned immediately before each request.
- SNI and certificate verification preserve the authorized hostname.
- Request cancellation and timeout propagation remain part of the trusted transport contract.

### HTTP discovery mediator

New closed execution class inside the mediator/sandbox layer:

`phase11_http_discovery_v1`

The mediator profile contains only trusted authorization-derived target state plus closed provider policy fields:

- capability: `web.http.probe.v1` or `web.route.discover.v1`
- discovery profile: `root-only` or `well-known-safe`
- method profile: `GET_ONLY` or `HEAD_THEN_GET`
- same-origin redirect boolean
- bounded request/time budget

It does not accept arbitrary URL, path, header, body, proxy, command, argv, host, or port fields.

Code-owned routes are exactly:

- `/`
- `/.well-known/security.txt`
- `/robots.txt`
- `/sitemap.xml`

The root-only profile uses only `/`.

The mediator:

- uses HEAD first only when the reviewed method profile requests it
- falls back to GET only for 405/501
- follows at most one redirect for a fixed route and only when the redirect remains inside the authorized hostname/scheme/port boundary
- re-runs DNS/IP safety through the pinned HTTPS transport for each request
- caps the total request budget at 12
- caps per-request timeout at 5 seconds
- caps total execution timeout at 30 seconds
- returns at most four privacy-reduced records
- retains only route kind, status, bounded content type, redirect state, and a closed redirect-block reason
- never returns response bodies or unrestricted header maps
- checks cancellation before requests and after route completion

### Executor containment

The worker entry, mediator session protocol, Unix response validation, and runtime sandbox recognize the new execution class.

The executor still runs with:

- `--network=none`
- immutable OCI image digest
- `--read-only`
- `--cap-drop=all`
- `--security-opt=no-new-privileges`
- `--pids-limit=8`
- 256 MiB memory
- swap disabled
- 0.5 CPU
- no container logs
- fixed uid/gid
- cleared environment
- 8 MiB noexec/nosuid/nodev scratch tmpfs
- exactly one read-only mediator Unix socket bind

The HTTP discovery mediator response boundary is 32 KiB.

Mediator sessions remain single-use and attempt-bound.

## Deliberately not implemented in this slice

- no production worker queue registration
- no worker-table execution-class widening
- no Supabase migration
- no public/browser action
- no provider feature flag
- no hosted runtime enablement
- no Nmap process runner
- no Nuclei process runner
- no shell execution
- no direct network authority in the provider adapter or executor

This separation is intentional. The new class must first pass normal repository validation and then receive a separately reviewed forward-only queue/control migration.

## Validation required before merge

Run the normal full CI and specifically cover:

- runtime HTTPS GET/HEAD contract
- HTTP discovery fixed route behavior
- HEAD fallback behavior
- same-origin redirect limit
- cross-host redirect rejection
- cancellation before request
- request-capacity fail-closed behavior
- mediator session replay rejection
- mediator wire result schema
- Podman `--network=none` containment
- runtime output/time ceilings
- architecture authority guard
- TypeScript typecheck
- application/CLI builds and existing security regression suite

## Next gate after this slice

If this branch merges cleanly:

1. design a forward-only Phase 11C worker queue/control migration for `phase11_http_discovery_v1`
2. bind worker preparation to immutable Phase 11 run/action authorization rather than browser input
3. resolve canonical target locators only inside trusted preparation/mediator state
4. bridge successful mediator records into the existing `scopeforge.http-discovery` provider normalizer with trusted evidence references
5. keep the hosted feature flag default-off
6. rebuild the immutable runtime image
7. repeat affected real Linux rootless-Podman/cgroup-v2 containment acceptance before any runtime enablement

Nmap and Nuclei process runners remain behind their separate binary/image/license/template and containment gates.
