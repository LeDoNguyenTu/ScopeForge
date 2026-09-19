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
- a dedicated authenticated finalization route that accepts only task/attempt/lease identity plus the closed terminal envelope
- exact-digest terminal replay protection and authoritative cancellation-race handling
- trusted conversion of privacy-reduced worker records into the existing HTTP discovery provider raw result
- existing provider normalization with server-derived target, authorization, observation timestamp, and evidence references
- one atomic service-role-only finalization RPC that revalidates lease/action/snapshot scope, persists normalized observations and the Phase 11 action attempt, then terminalizes the action
- successful, failed, and cancelled terminal paths with observations prohibited outside success

The new class is now wired through the generic worker contract/parser and supervisor dispatcher because its immutable queue binding, authenticated preparation, and atomic finalization boundaries are complete. The dedicated Phase 11 validators remain authoritative for its closed claim and terminal shapes.

Hosted enablement is still default-off. PR #147 adds explicit worker-host configuration for `phase11_http_discovery_v1` after exact-image Linux acceptance, but no production worker environment or identity exists and the Phase 11/Phase 11C migrations remain unapplied.

## Next source work

1. require exact-head CI and merge PR #147
2. keep hosted enablement default-off
3. install only the accepted immutable image digest on the dedicated worker host
4. prove authenticated idle claim/heartbeat and class-scoped rollback
5. recheck and apply only the reviewed absent migrations in a separately recorded operational release
6. run one bounded authorized production canary before leaving the class enabled

## Production boundary

- Phase 11 migrations remain unapplied.
- No new Phase 11 worker-control migration is applied.
- No external HTTP provider binary is enabled.
- No Nmap or Nuclei runner is enabled.
- No browser role receives canonical worker or Phase 11 DML authority.


## Generic wiring checkpoint

The current candidate additionally:

- adds `phase11_http_discovery_v1` to the generic worker execution-class union
- validates generic claims through the dedicated Phase 11 HTTP input validator
- validates generic terminals through the dedicated Phase 11 HTTP terminal validator
- adds strict HTTP control-client parsing for the dedicated prepare response
- routes supervisor preparation and finalization through the Phase 11-specific endpoints
- reuses the existing single-use Unix mediator and `--network=none` runtime sandbox
- injects the Phase 11 HTTP runtime executor explicitly rather than falling through to legacy runtime behavior
- kept the normal hosted worker runtime configuration unable to select the class before Linux acceptance; PR #147 adds the separately reviewed post-acceptance configuration


## Release-candidate validation

- Diagnostic CI #1191 identified two stale architecture assertions from the pre-wiring state.
- Both were updated to permit only the exact reviewed `phase11_http_discovery_v1` class while preserving the prohibition on generic URL/fetch/proxy execution authority.
- A fresh exact-head full CI is required after this release-candidate commit.


## Cancellation and recovery hardening

The release-candidate review found and fixed three additional control-plane issues before merge:

- Phase 11 HTTP queue and claim transitions now keep the privacy-reduced public action summary synchronized with private action state at `queued` and `running`.
- The shared heartbeat now has an authorization-aware Phase 11 branch. Phase 11 tasks do not require a legacy `scan_jobs` row, and cancellation or authorization expiry is surfaced through the normal worker heartbeat.
- Phase 11 HTTP now has dedicated recovery before legacy scan-job recovery. Unclaimed expired/cancelled work and expired leases terminalize the worker task plus the Phase 11 action/public summary with an auditable action-attempt record.

The queue adapter also now has a concrete Supabase-backed repository, a service-role-only cancellation RPC, and reusable server dependencies. Queued work cancels immediately. Leased work preserves the live lease and lets authoritative heartbeat cancellation drive normal worker finalization.

No production migration or hosted enablement was performed.


## Validation

- CI #1193 passed the complete test suite but failed TypeScript on two implicit queue-repository input parameter types.
- The queue repository inputs are now explicitly derived from the repository interface. Exact-head CI after this fix is the current release gate.


## Request-accounting hardening

A final security review found that failed or cancelled HTTP executions could previously reach Phase 11 finalization with a zero request count even after network activity had occurred. That could undercount the run request budget.

The source now fails safe on accounting:
- successful mediator results persist their exact request count
- cancellation that races a successful mediator result preserves that exact count
- failed or cancelled attempts without an exact mediator count conservatively persist the action authorization's `maxRequests`
- the database finalizer no longer zeroes request count for non-success outcomes

This is intentionally conservative: uncertainty may consume more budget, but it cannot make attempted network work disappear from accounting.

Exact current-head CI is required after this hardening before PR #143 can merge.
