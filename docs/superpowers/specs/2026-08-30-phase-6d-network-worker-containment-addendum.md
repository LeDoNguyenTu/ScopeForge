# Phase 6D Network Worker Containment Addendum

Status: normative companion to `2026-08-30-phase-6d-network-workers-design.md`.

If this addendum conflicts with wording in the base Phase 6D design, this addendum takes precedence.

## Reason for the addendum

The Phase 6D threat model includes a potentially compromised worker executor process. In-process URL validation, DNS checks, and request-shape validation are not sufficient containment for that threat because a compromised process could attempt to open raw sockets outside the intended request path.

Phase 6D therefore requires network authority to be enforced outside the executor process.

## Revised network-execution boundary

The class executor for `passive_runtime_observation_v1` and `active_cors_validation_v1` must not have unrestricted raw outbound network access.

The executor communicates with a trusted supervisor-owned network mediator using a local-only IPC channel. The mediator is outside the executor's process authority and owns all external DNS, TCP, TLS, and HTTP I/O.

The executor may request only class-specific operations that are already authorized by its lease-bound preparation profile. It cannot submit arbitrary URLs, methods, headers, bodies, ports, proxy destinations, or DNS names outside the closed class state machine.

The base-design execution step that says the dedicated executor performs allowed network activity is therefore interpreted as:

`class executor -> closed class request -> trusted network mediator -> external target`

The executor does not create the external socket itself.

## Mediator authority

The mediator is trusted infrastructure, but it is not a generic HTTP proxy.

It accepts only two versioned request families:

- passive runtime request transitions for `passive_runtime_observation_v1`
- the single fixed CORS request for `active_cors_validation_v1`

Every mediator request is bound to:

- task ID
- attempt ID
- execution class
- lease identity
- short-lived prepared execution profile
- attempt deadline
- class-specific request ordinal

The mediator rejects any request that does not match the active prepared state.

## Passive mediator state machine

For passive runtime observation, the mediator owns the authoritative request counter and redirect-transition state.

The executor may ask for the next passive request only through a closed operation that represents the existing observer transition. The mediator verifies:

- request count remains at or below 4
- redirect count remains at or below 3
- total deadline remains valid
- requested URL is either the prepared canonical target or the exact next redirect target accepted by the class-specific redirect policy
- HTTPS is required
- URL credentials are absent
- DNS/IP policy passes for the destination immediately before connection
- TLS certificate verification matches the authorized hostname
- request method and headers remain the fixed passive profile
- response reading stays within bounded header/metadata requirements

The executor cannot supply a new arbitrary redirect target. Redirect destination input originates from the previous mediated response and is passed through the existing passive redirect policy before the mediator can transition to the next destination.

## Active CORS mediator state machine

For active CORS validation, the mediator permits exactly one state transition from `prepared` to `request_sent`.

The external request is constructed inside the mediator from the prepared profile and compile-time CORS profile constants.

The executor does not supply:

- URL
- method
- port
- Origin
- user agent
- Accept value
- body
- credentials
- redirect policy

The mediator enforces:

- canonical prepared URL only
- HTTPS port 443 only
- GET only
- fixed synthetic Origin
- fixed ScopeForge active runtime user agent
- fixed Accept header
- no body
- no credentials
- no redirect following
- at most one external request

A second request for the same attempt is rejected even if the executor process asks for one.

## DNS and connection containment

DNS resolution occurs inside the mediator, not the executor.

The mediator performs the established runtime public-IP classification immediately before external connection. Unsafe answers cause fail-closed termination.

The mediator connects to an approved resolved IP while preserving the authorized hostname for SNI and certificate verification.

The executor does not receive a reusable raw socket or general-purpose destination IP list.

## OS-level enforcement

The executor sandbox must be configured so direct outbound networking is unavailable independently of application code.

Acceptable implementation mechanisms include a dedicated network namespace, container network policy, or equivalent host-level enforcement that leaves only the local mediator IPC path reachable from the executor.

Application-level convention alone is not sufficient.

The exact Linux mechanism is an implementation choice, but operational acceptance must prove that an executor attempting to create an arbitrary external connection cannot succeed.

## Mediator isolation

The mediator must not run target-controlled code or scanner plugins.

It processes only:

- trusted prepared profiles
- closed executor transition requests
- DNS answers
- TLS/HTTP protocol metadata required by the existing Phase 4 observation builders

It must not expose a browser/public endpoint.

It must not accept arbitrary request JSON from the Vercel application or user-facing APIs.

## Cancellation

Cancellation state is checked by trusted worker control before mediator authorization and between allowed transitions.

The mediator must refuse any new external request after cancellation becomes authoritative.

If cancellation arrives while one request is already in flight, the mediator should abort the request where supported. Regardless of transport abort success, no additional request may be sent and no successful terminal publication may override cancellation.

## Failure behavior

Attempts to bypass the closed mediator contract are treated as worker-policy violations and fail closed.

Examples:

- unknown IPC operation
- URL not matching prepared state
- method/header/body fields supplied where forbidden
- second active request
- passive request/redirect limit exceeded
- expired attempt deadline
- mismatched task/attempt/class
- direct egress attempt detected by sandbox acceptance tests

These failures must not trigger a fallback to direct Vercel network execution.

## Additional acceptance tests

Phase 6D production enablement requires proof that:

1. The executor sandbox cannot directly reach an external test endpoint.
2. The same executor can reach the approved target only through the mediator's class-specific transition API.
3. A passive executor cannot ask the mediator to contact an unrelated public URL.
4. An active executor cannot change the target URL, method, port, Origin, headers, body, or redirect behavior.
5. A compromised executor cannot reuse another attempt's prepared profile or mediator channel.
6. Cancellation prevents new mediated requests.
7. Mediator restart/failure causes fail-closed worker failure rather than direct-network fallback.
8. Logs from both executor and mediator remain within the Phase 6D privacy rules.

## Security consequence

With this boundary, compromise of the class executor does not automatically become arbitrary outbound network authority. The maximum external effect remains constrained by a separate trusted mediator that knows only the lease-bound, class-specific request state machine.

This is required for Phase 6D implementation approval.
