# Phase 11C First External Provider Execution Design

Status: approved for source implementation under existing autonomous continuation authority. Runtime enablement remains separately gated.
Date: 2026-09-18
Depends on: released Phase 11A planning/orchestration and Task 11 deterministic evaluation harness.

## Goal

Introduce the first external-provider adapter slice without allowing an external scanner to redefine ScopeForge authorization, target scope, budgets, evidence, or execution architecture.

This design covers bounded HTTP probing, reviewed Nuclei adapter contracts, deferred Nmap contracts, provider runner separation, worker containment, and default-off registration.

It does not authorize production provider execution.

## Decisions

1. Implement adapter contracts before real external process execution.
2. Keep process creation and network authority outside planner, policy, and capability-registry packages.
3. Provider packages use injected runner contracts and are fully testable with synthetic output.
4. HTTP probing is the first implementation slice because it needs the smallest useful execution authority.
5. Nuclei follows only after an exact reviewed template snapshot is pinned.
6. Nmap remains deferred until its NPSL deployment and distribution decision is accepted.
7. Every real network-enabled provider execution class requires separate Linux containment acceptance.
8. No fallback may run an external scanner directly from Vercel or Next.js.

## Trust boundary

Planner
-> ActionIntent
-> trusted policy
-> ActionAuthorization
-> capability registry
-> closed provider adapter
-> trusted provider runner
-> dedicated worker execution class
-> external provider binary
-> bounded raw provider result
-> provider normalizer
-> Observation[]
-> existing evidence validation and graph update

The external provider never receives service-role credentials, arbitrary planner text, arbitrary shell commands, arbitrary provider flags, unrestricted URLs, unbounded request counts, unbounded runtime, or raw long-lived credentials.

## Provider package authority

Provider packages may validate a closed typed request, produce an immutable internal execution plan, invoke an injected runner, parse bounded output, normalize observations, and request idempotent cleanup.

Provider packages must not directly import node:child_process, generic node:http/https/net/tls/dns, Supabase clients, worker control clients, container runtimes, arbitrary filesystem APIs, application UI code, or model providers.

An architecture test must enforce this rule.

## Common runner boundary

Provider adapters use a narrow internal runner abstraction with:

- provider ID and exact provider version
- capability ID
- action and authorization ID
- exact target node IDs
- a fixed executable profile ID
- adapter-generated closed arguments
- max runtime
- max output bytes
- AbortSignal cancellation
- explicit cleanup

The worker owns executable lookup. The executable profile maps to one immutable reviewed provider binary or image. Callers never provide the argument array directly.

## First slice - bounded HTTP probe

Capability: web.http.probe.v1
Provider ID: projectdiscovery.httpx
Reviewed version: 1.12.0
Execution mode: safe_active
Runtime state: disabled until containment acceptance.

### Closed request

The v1 request permits only:

- scheme: http or https
- hostname: trusted prepared hostname
- one integer port from 1 through 65535
- maxRedirects: 0 through 3
- a deduplicated set of reviewed probes such as status, title, server, content_type, and tls

The v1 request rejects:

- unknown keys
- paths and query strings
- arbitrary methods
- arbitrary headers
- caller proxies
- input or output file paths
- screenshots and headless mode
- arbitrary port ranges
- caller resolvers
- raw provider flags
- generic pipeline modes

The hostname must come from the trusted worker preparation boundary, not directly from a browser request.

### Internal provider arguments

The adapter constructs one reviewed deterministic argument profile. Tests use a golden exact argument list. A future argument addition requires review and a changed test.

Structured JSON or JSONL output is required. Free-form text scraping is not accepted when the provider supports structured output.

### Normalization

The adapter may emit only reviewed bounded facts such as response status, authorized host identity, redirect count, content type, reduced server metadata, bounded TLS metadata, and reviewed technology identifiers.

It must not copy response bodies, cookies, authorization headers, full query strings, arbitrary headers, or raw stderr into Phase 11 observations.

## HTTP worker containment

Real httpx execution requires a new dedicated class. Design-level names:

- execution class: web_http_probe_bounded_v1
- network policy: web_http_probe_target_bound_v1

These names are not enabled by this document.

Real Linux acceptance must prove exact target/IP egress, trusted DNS resolution, redirect re-authorization, metadata/private/link-local/multicast/loopback rejection outside explicit lab policy, no generic Internet egress, no proxy bypass, no package download, read-only filesystem, dropped capabilities, no-new-privileges, bounded PID/CPU/memory/wall/scratch/output, process-tree cancellation, forced cleanup, and secret-safe logs.

## Nuclei slice

Capability: web.template.validate.v1
Provider ID: projectdiscovery.nuclei
Reviewed engine version: 3.11.1
Initial mode: safe_active
Runtime state: disabled.

Nuclei execution is blocked until docs/dependencies/security-providers.md records an exact nuclei-templates commit, upstream checksum, and ScopeForge allowlist digest.

The first template policy rejects:

- code protocol templates
- JavaScript templates
- headless templates
- fuzzing and DAST templates
- local file access
- state-mutating templates
- user-supplied templates
- arbitrary provider template paths
- moving tags or latest
- engine or template auto-update
- OOB callback behavior unless separately designed

The adapter accepts a ScopeForge template policy ID rather than a provider file path.

Every normalized result preserves engine version, template ID, template snapshot digest, action authorization ID, target node ID, and evidence reference.

A Nuclei match never directly promotes a finding to confirmed.

## Nmap slice

Potential capabilities:

- network.port.discover.v1
- network.service.fingerprint.v1

No source change under this design may bundle, download, or redistribute Nmap.

A synthetic adapter contract can be tested, but a real runner remains blocked on the NPSL decision in docs/dependencies/security-providers.md.

If later accepted, callers still cannot choose NSE scripts, script arguments, arbitrary port ranges, spoof/decoy modes, timing templates, raw packet techniques outside the reviewed profile, or output paths.

## Adapter contract tests

Before real runner code, each provider must test:

1. valid closed request accepted
2. unknown field rejected
3. invalid target rejected
4. capability/provider version mismatch rejected
5. execution mode mismatch rejected
6. budgets cannot exceed authorization
7. deterministic exact internal arguments
8. no caller arbitrary flags
9. timeout maps to stable failure
10. AbortSignal cancellation reaches the runner
11. oversized output rejected before parsing
12. malformed output fails closed
13. unexpected output cannot add authority
14. provider/version/evidence provenance retained
15. raw secrets and raw stderr absent from observations
16. cleanup idempotent
17. replay preserves authorization identity

## Worker boundary

The future worker receives only exact action ID, authorization ID, prepared authorized target, reviewed capability/provider profile, exact budgets, cancellation/deadline, and immutable provider binary/image identity.

The worker does not receive arbitrary CLI strings, arbitrary browser URLs, service-role credentials, planner/model text, or unrestricted environment variables.

## Supply-chain update flow

Every provider update is an explicit reviewed change containing:

- old and new version
- upstream release/security notes
- exact release artifact checksum
- worker image digest
- template snapshot/digest if applicable
- golden argument diff
- normalization compatibility tests
- containment regression evidence
- exact-candidate CI

Provider self-update is forbidden during execution.

## Stable failures

Provider execution should distinguish at least:

- PROVIDER_REQUEST_INVALID
- PROVIDER_VERSION_MISMATCH
- PROVIDER_NOT_AVAILABLE
- PROVIDER_TIMEOUT
- PROVIDER_CANCELLED
- PROVIDER_OUTPUT_TOO_LARGE
- PROVIDER_OUTPUT_INVALID
- PROVIDER_EXECUTION_FAILED
- PROVIDER_CLEANUP_FAILED

Raw stderr is reduced trusted diagnostic input only. It is never copied into browser responses or canonical findings.

## Source-only merge criteria

Adapter source may merge before runtime enablement only when:

- dependency review is complete
- request schemas are closed
- adapter tests are deterministic
- hostile parser tests pass
- output is privacy-reduced
- architecture tests prove no direct process/network authority
- provider registration remains disabled/unavailable
- no production migration is applied
- no external provider binary is added to the Vercel artifact

## Real execution gate

No external provider can be enabled until dedicated Linux acceptance proves target-only egress, DNS/rebinding controls, process-tree termination, PID compatibility, CPU/memory/disk/output ceilings, read-only filesystem, dropped capabilities, no metadata or control-socket access, secret-safe environment/logs, and deterministic cleanup.

Acceptance evidence must record the exact provider image digest and runtime context.

## Implementation order

1. Dependency and licensing review.
2. Provider-common closed execution-plan types.
3. httpx adapter contract tests.
4. httpx adapter using an injected runner only.
5. Architecture tests proving no direct provider package process/network authority.
6. Nuclei adapter tests and normalizer against synthetic output.
7. Pin the safe Nuclei template snapshot.
8. Dedicated worker containment implementation.
9. Real Linux acceptance.
10. Runtime registration stays default-off until an explicit enablement release.
11. Nmap follows only after its licensing gate.

## Non-goals

This slice does not add arbitrary CLI access, arbitrary shell execution, unrestricted crawling, authenticated browser sessions, fuzzing, brute force, denial of service, exploit payload execution, post-exploitation, lateral movement, persistence, production Phase 11 schema rollout, or direct Vercel scanner execution.
