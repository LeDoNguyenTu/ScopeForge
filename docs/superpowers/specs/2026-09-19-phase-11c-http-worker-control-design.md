# Phase 11C HTTP discovery worker control design

Status: source implementation approved under the existing Phase 11 continuation authority. Production schema application and hosted runtime enablement remain separately gated.

Date: 2026-09-19

Depends on:

- Phase 11 run orchestration and immutable authorization snapshots
- Phase 11C provider contracts released through PR #141
- Phase 11C first-party HTTP discovery mediator/runtime foundation released through PR #142
- existing Phase 6D worker authentication, leasing, cancellation, containment, and mediator infrastructure

## Goal

Connect an approved Phase 11 HTTP discovery action to the dedicated worker control plane without allowing browser state, planner text, arbitrary URLs, arbitrary network policy, or stale authorization to define runtime authority.

This slice adds only the trusted queue/control and preparation boundary for the closed execution class:

`phase11_http_discovery_v1`

It does not enable hosted execution.

## Core authority rule

The queue request is identified by trusted Phase 11 state:

- workspace ID
- run ID
- action ID
- authorization ID

Everything else is reloaded from authoritative private Phase 11 state.

The caller cannot supply:

- target URL
- hostname
- path
- headers
- body
- method
- provider flags
- provider binary
- execution class
- network policy
- worker budget
- authorization expiry
- capability version
- provider version

## Supported Phase 11 actions

The first queue/control slice accepts only:

- `web.http.probe.v1`
- `web.route.discover.v1`

Provider:

- `scopeforge.http-discovery`
- version `1.0.0`

Execution mode:

- `safe_active`

Exactly one target node is required.

The action must already have an approved or narrowed authorization and an active enqueue reservation from trusted Phase 11 orchestration.

## Immutable worker binding

A new private binding record should connect one worker task to one Phase 11 action authorization.

Conceptual fields:

- task ID
- workspace ID
- run ID
- action ID
- authorization ID
- authorization snapshot reference
- target node ID
- capability ID
- capability version
- provider ID
- provider version
- schema version
- created timestamp

The binding is immutable after insert.

A unique constraint on the authorization identity makes queue creation replay-safe.

The binding references the existing private Phase 11 run/action state and the existing worker task.

## Queue RPC

The trusted queue RPC must be service-role-only.

Input:

- workspace ID
- run ID
- action ID
- authorization ID

Before creating a worker task it must lock and validate the Phase 11 action and authorization snapshot.

Required checks:

1. run exists in the same workspace
2. action belongs to the exact run/workspace
3. action state is `enqueueing`
4. decision status is `approved` or `narrowed`
5. action authorization ID exactly matches the requested authorization ID
6. authorization snapshot reference matches the run
7. authorization snapshot has not expired
8. action authorization expiry has not expired
9. requested mode is `safe_active`
10. capability ID is one of the two reviewed HTTP discovery capabilities
11. capability version matches the reviewed contract
12. target node cardinality is exactly one
13. the target node is inside the immutable authorization snapshot
14. the target graph node belongs to the same run/workspace
15. the target graph node authorization reference matches the action snapshot
16. closed parameters contain only the reviewed HTTP discovery parameter keys and values
17. action max request/runtime budgets fit inside the worker execution profile
18. the run is not terminal or cancelled

The RPC creates the private worker task and immutable Phase 11 binding atomically.

On replay with the same authorization identity it returns the existing task only if every immutable identity field matches.

Any identity drift fails closed.

## Closed worker task input

The public worker claim contract must not carry a URL.

The claim input contains only:

`{ kind: "phase11_http_discovery", runId, actionId, authorizationId }`

These identifiers are sufficient for the internal preparation route to load authoritative state.

## Trusted preparation

Worker preparation runs only after worker authentication and lease validation.

Preparation must:

1. load the exact immutable worker-task binding
2. lock/revalidate the Phase 11 action and run
3. reject cancelled/terminal/stale authorization
4. resolve the target graph node to its canonical locator inside trusted server code
5. require an HTTPS web target on port 443 for this first runtime slice
6. derive the closed mediator profile from the action's reviewed closed parameters
7. clamp request/runtime budgets to the worker profile and action authorization
8. create an attempt-bound single-use mediator session
9. never return service-role credentials or unrestricted network material to the container

The container remains `--network=none`; host network authority remains only in the mediator.

## Closed parameters

Initial reviewed keys:

- `discoveryProfile`: `root-only` or `well-known-safe`
- `methodProfile`: `GET_ONLY` or `HEAD_THEN_GET`
- `followSameOriginRedirects`: boolean

Capability-specific rule:

- `web.http.probe.v1` requires `root-only`

No unknown parameter is accepted.

## Worker profile

The new execution profile is fixed in trusted code:

- execution class: `phase11_http_discovery_v1`
- network policy: `phase11_http_discovery_target_bound_v1`
- max wall time: 30 seconds
- max processes: 1
- max memory: 256 MiB
- max scratch: 8 MiB
- max output: 32 KiB
- zero input files
- container network: none

The mediator enforces the finer request/time budget.

## Terminal result

The worker terminal result is privacy-reduced and mirrors the mediator result:

- kind `phase11_http_discovery`
- request count
- up to four fixed-route records
- route kind
- status
- bounded content type
- redirect boolean
- closed redirect-block reason

It contains no response body, unrestricted headers, cookies, credentials, target URL, raw stderr, or provider-native output.

## Finalization and observation bridge

Successful worker finalization does not directly confirm a finding.

Trusted finalization must:

1. revalidate worker task, attempt, action, authorization, and cancellation state
2. persist a Phase 11 action attempt
3. convert the mediator result into the existing `scopeforge.http-discovery` provider raw result using trusted target/evidence references
4. call the existing provider normalizer
5. persist normalized observations through trusted Phase 11 observation persistence
6. transition the action to terminal only after authoritative persistence succeeds

Cancellation and failures record stable terminal status without observations.

## Database security

Any new private table is RLS-enabled as defense in depth and revoked from public, anon, authenticated, and service_role direct table access.

Trusted mutation functions must:

- use `SECURITY DEFINER`
- pin `search_path = ''`
- revoke EXECUTE from PUBLIC, anon, and authenticated
- grant only to service_role
- validate every workspace/run/action/authorization binding internally

No browser role receives direct canonical DML.

## Release sequence

1. lock TypeScript worker task/result/profile contracts
2. add trusted preparation/finalization service interfaces and unit tests
3. create the forward-only migration with service-role-only queue/control RPCs
4. add migration privilege/identity tests
5. wire the internal worker prepare/finalize routes
6. run exact-head CI
7. merge source-only with hosted capability still disabled
8. rebuild the immutable runtime image
9. repeat affected real Linux rootless-Podman/cgroup-v2 acceptance
10. only then consider a separately reviewed enablement release

## Explicit non-goals

This slice does not:

- apply Phase 11 migrations to production
- enable the new worker class in production
- expose browser enqueue
- add an external httpx binary
- add Nmap or Nuclei runners
- allow arbitrary HTTP requests
- allow non-HTTPS or non-443 targets
- widen redirect origin
- add credentials or authenticated testing
- add arbitrary provider arguments
