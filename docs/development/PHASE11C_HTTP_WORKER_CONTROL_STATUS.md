# Phase 11C HTTP worker control status

Last reconciled: 2026-09-19, Asia/Singapore. Live repository state wins if newer.

## Released prerequisites

- PR #141 released the hardened default-off provider contracts.
- PR #142 released the bounded first-party HTTP discovery mediator/runtime foundation at merge `30b45974126797509eb66dd12f26528970a7bdee`.
- Ordinary feature branches do not auto-deploy to Vercel. Production remains `main` only unless an explicit `vercel-preview-*` branch is created.

## Current source-only slice

Branch: `feat/phase-11c-http-worker-control-20260919`.

Implemented so far:

- dedicated non-production execution profile contract for `phase11_http_discovery_v1`
- claimed worker input limited to immutable Phase 11 run/action/authorization identifiers
- privacy-reduced terminal result validation
- closed HTTP discovery failure-code set
- trusted preparation service over an injected authoritative repository
- run/action/snapshot/target/capability/provider identity revalidation
- authorization expiry and target-scope revalidation
- exact closed parameter validation
- HTTPS/443 target canonicalization in trusted code
- request/runtime budget checks and clamping
- no browser URL, hostname, method, headers, body, provider argv, network policy, or target node authority in the claimed input
- replay-safe orchestration queue adapter keyed by the version-bound Phase 11 authorization ID
- opaque queue references with cancellation routed back through the trusted repository boundary
- architecture guard keeping queue/preparation free of direct database, process, and network authority
- forward-only source migration for an immutable private worker-task binding keyed by the stable Phase 11 authorization ID
- a replay-safe service-role-only enqueue RPC that reloads and locks authoritative run/action state
- fail-closed queue validation for run state, decision state, authorization expiry, snapshot identity, execution mode, capability/version, target scope, closed parameters, and budgets
- a service-role-only preparation-context RPC bound to the exact authenticated worker lease and immutable Phase 11 binding
- the shared worker-task table can represent this class only with null legacy scan-job/asset fields, one attempt, and an exact 30-second deadline
- dedicated service-role-only worker registration and claim RPCs for `phase11_http_discovery_v1`
- claim-time revalidation of run/action/snapshot expiry and exact binding identity before the one-attempt lease is created
- server worker-control repository/service routing for authenticated Phase 11 nodes, without widening the generic worker-runtime parser or terminal finalizer
- a dedicated authenticated internal preparation route that accepts only task/attempt/lease identity
- strict parsing of the lease-bound authoritative preparation context before trusted HTTPS/443 target derivation
- typed Phase 11C worker RPC definitions, preserving the repository source-hygiene rule against unsafe RPC casts

The new class intentionally remains outside the generic production `WorkerExecutionClass` union at this checkpoint. It cannot be registered, claimed, or dispatched by the production fleet yet.

## Next source work

1. add terminal finalization/observation persistence with exact action and authorization revalidation
2. widen the generic worker-runtime parser, dispatcher, and terminal types only when preparation and finalization are complete together
3. keep hosted enablement default-off
4. perform real Linux containment acceptance before any enablement release

## Production boundary

- Phase 11 migrations remain unapplied.
- No new Phase 11 worker-control migration is applied.
- No external HTTP provider binary is enabled.
- No Nmap or Nuclei runner is enabled.
- No browser role receives canonical worker or Phase 11 DML authority.
