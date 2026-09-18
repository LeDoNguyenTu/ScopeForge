# Phase 11C Provider Execution Design

Date: 2026-09-18
Status: implementation foundation prepared, external execution remains disabled

## Objective

Introduce the first external-provider boundary for Phase 11 without allowing the planner, model, browser, or public API to construct raw scanner commands, arbitrary URLs, template paths, headers, request bodies, or process arguments.

This slice prepares three provider contracts:

- `provider-nmap` for bounded port discovery and service fingerprinting
- `provider-nuclei` for reviewed-template validation only
- `provider-http-discovery` for first-party bounded HTTP probing and well-known route discovery

The packages are intentionally runner-injected. They validate closed requests, enforce target-node binding, normalize privacy-reduced observations, and reject unreviewed result material. They do not import `child_process`, open sockets, resolve DNS, or execute a provider binary themselves.

## Trust boundary

The trusted run orchestrator continues to be the sole owner of `ActionAuthorization`. A provider receives only:

- an authorized `targetNodeId`, never a planner-supplied network locator
- a closed capability identifier
- a closed profile enum
- immutable execution budgets from `ProviderExecutionContext`
- an `AbortSignal`

Target-node to locator resolution belongs in the dedicated worker execution class. The worker must resolve the target from the authoritative asset graph and compare it to the immutable authorization snapshot before any network activity.

## Forbidden planner-controlled inputs

The first provider slice rejects all unknown request fields. In particular it must never accept:

- arbitrary command-line arguments
- raw executable names or paths
- raw target hostnames, IP addresses, URLs, paths, query strings, or request bodies
- arbitrary HTTP headers or cookies
- arbitrary Nuclei template paths, template URLs, workflows, JavaScript, code templates, headless templates, OAST configuration, or unsigned custom templates
- raw Nmap NSE scripts or script arguments
- shell fragments

## Provider boundaries

### Nmap

Capabilities:

- `network.port.discover.v1`
- `network.service.fingerprint.v1`

Initial mode: `safe_active` only.

Closed profiles:

- port profile: `top-100`, `top-1000`, or `reviewed-explicit`
- explicit ports: maximum 64, each 1-65535
- timing profile: `polite` or `normal`

No NSE support is included in this slice. The runner receives node IDs and policy-approved profiles, not native flags.

### Nuclei

Capability:

- `web.template.validate.v1`

Initial mode: `validation` only.

The request chooses one code-owned template profile, not template IDs or file paths. The provider expands that profile to a reviewed allowlist and fails closed if the runner reports a template ID outside the approved manifest.

Initial profiles:

- `baseline-http`
- `misconfiguration-reviewed`
- `known-cve-reviewed`

The initial worker implementation must additionally enforce HTTP-only reviewed templates. JavaScript, code, headless, file, fuzz/DAST, workflow, OAST/Interactsh, and arbitrary user-supplied templates stay disabled until separately threat-modeled.

### HTTP discovery

Capabilities:

- `web.http.probe.v1`
- `web.route.discover.v1`

Initial mode: `safe_active` only.

Closed profiles:

- `root-only`
- `well-known-safe`

The first route set is code-owned and limited to root plus standard well-known discovery candidates such as security.txt, robots.txt, and sitemap metadata. General crawling, OpenAPI import, GraphQL introspection, parameter mining, and browser discovery belong to Task 12.

## Evidence and normalization

Raw provider output is not a public read model. Each provider emits only normalized `Observation` records with:

- deterministic observation IDs
- canonical evidence references
- primitive bounded facts
- immutable provider/version/capability identity
- authorization snapshot reference
- execution mode

URLs, response bodies, raw banners, command lines, and scanner stdout/stderr stay in evidence storage and worker telemetry, subject to existing evidence retention/redaction policy. The provider adapters deliberately avoid copying those fields into planner-visible observations.

## Runtime containment required before enablement

External execution remains disabled until the dedicated Linux worker class proves all of the following:

1. rootless execution under the existing worker isolation model
2. immutable image/tool version pinning
3. no shell invocation, only argv arrays produced by trusted code
4. read-only root filesystem where compatible
5. bounded tmpfs/scratch storage
6. CPU, memory, PID, file-descriptor, request, and wall-clock ceilings
7. outbound target enforcement from the authoritative authorization snapshot
8. cancellation propagation that kills the complete provider process group
9. stdout/stderr byte ceilings and structured parser limits
10. no credential inheritance unless a capability explicitly declares and policy authorizes a credential class
11. cleanup after cancellation, timeout, parser failure, and worker restart
12. evidence persistence before privacy-reduced normalization is exposed to planning

## Feature flags

The real provider runners must remain default-off. Suggested runtime flags:

- `PHASE11_PROVIDER_NMAP_ENABLED=false`
- `PHASE11_PROVIDER_NUCLEI_ENABLED=false`
- `PHASE11_PROVIDER_HTTP_DISCOVERY_ENABLED=false`

No hosted deployment should flip these flags until Linux containment acceptance and the corresponding provider dependency record are complete.

## Licensing boundary

See `docs/dependencies/security-providers.md`.

The important Nmap constraint is that ScopeForge must not casually bundle or redistribute Nmap in application/container artifacts. The first integration is designed around an operator-installed, version-verified executable. Any redistribution/container-bundling decision requires a fresh NPSL/OEM review and explicit attribution handling.

Nuclei is MIT licensed. The Nuclei template corpus is also treated as a separately pinned dependency and reviewed manifest, not as an automatically updating runtime feed.

## Release gates

This foundation can merge without enabling external scanning because it performs no real provider execution. The next provider PR may add worker runners only after:

- exact dependency artifacts are pinned and verified
- the Linux containment acceptance harness is extended for each execution class
- reviewed Nuclei template manifests are committed with deterministic content hashes
- provider contract tests, typecheck, architecture tests, and CI are green
- the hosted environment remains default-off until explicit release validation
