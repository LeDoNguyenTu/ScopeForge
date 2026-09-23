# Phase 11 Security Provider Dependency Review

Status: design gate only - no external provider is enabled by this document  
Last reviewed: 2026-09-18  
Scope: Phase 11 Task 10 provider candidates

This file records the dependency, licensing, supply-chain, and distribution decisions that must exist before ScopeForge adds external security-provider execution.

The Phase 11 planner continues to request provider-neutral capabilities. It never receives provider command lines, arbitrary flags, arbitrary URLs, or unrestricted process authority.

## Release decisions

| Provider | Reviewed version | License | ScopeForge distribution decision | Current decision |
| --- | --- | --- | --- | --- |
| ProjectDiscovery httpx | v1.12.0 | MIT | May be packaged only in a dedicated bounded worker image after containment acceptance | Preferred first external execution candidate |
| ProjectDiscovery Nuclei | v3.11.1 | MIT | May be packaged in a dedicated worker image after template-policy and containment acceptance | Approved for adapter/contract work only |
| Nuclei templates | pinned snapshot required before enablement | MIT | Consume only a reviewed allowlisted snapshot with recorded commit/checksum | Not yet pinned - runtime enablement blocked |
| Nmap | 7.991 | Nmap Public Source License | Do not bundle or redistribute in ScopeForge images/packages under the current review | Deferred pending explicit licensing/distribution acceptance |

No provider listed here is enabled merely because its dependency review is present.

## ProjectDiscovery httpx

### Identity

- Repository: `projectdiscovery/httpx`
- Reviewed release: `v1.12.0`
- Reviewed release commit shown by upstream: `4b6a9a9`
- Release date: 2026-09-08
- License: MIT
- Intended capabilities:
  - `web.http.probe.v1`
  - later, narrowly bounded support for `web.route.discover.v1`

### Distribution model

ScopeForge may package the pinned httpx release inside a dedicated network-enabled worker image because the reviewed upstream license is MIT.

The package must not be imported into planner, policy, browser, or control-plane code.

The adapter must treat httpx as a standalone execution engine. ScopeForge owns:

- target authorization
- DNS/IP safety policy
- redirect policy
- request/rate/runtime budgets
- output bounds
- cancellation
- evidence normalization
- secret reduction
- graph updates

The upstream project explicitly warns that using httpx as a service can introduce security risk. ScopeForge therefore must not expose generic httpx service/CLI flags to users.

### Supply-chain policy

Before runtime enablement:

1. pin the exact release artifact or worker-image source revision
2. record the SHA-256 of the acquired release artifact
3. build the worker image reproducibly from the pinned artifact
4. record the resulting immutable image digest
5. reject startup if the provider version differs from the reviewed version
6. update only through a reviewed PR with adapter-contract and containment regression tests

Reviewed upstream GitHub release metadata records `httpx_1.12.0_linux_amd64.zip` SHA-256 `9d8439e8b6c9aa7d1e2314817a392e00d5178da3af5652f7475f88868f418f76` and `httpx_1.12.0_linux_arm64.zip` SHA-256 `fd7b123c1dfbc3d69f19f524e4eebcd6ec06b9a6cbd56813c76f11645197331e`. These pins remove the moving-artifact blocker, but runtime remains disabled until the dedicated image and containment gate are accepted.

### Closed execution policy

Allowed provider behavior must be generated entirely by reviewed adapter code.

Initial provider policy must prohibit or omit features that widen authority beyond a basic target-bound probe, including:

- caller-provided arbitrary flags
- caller-provided files
- caller-provided proxy settings
- unrestricted port sets
- arbitrary paths
- screenshots/headless execution
- local file access
- generic pipeline modes
- unconstrained redirect following
- output file paths chosen by the caller

## ProjectDiscovery Nuclei

### Identity

- Repository: `projectdiscovery/nuclei`
- Reviewed release: `v3.11.1`
- Reviewed release commit shown by upstream: `a8c88fe`
- Release date: 2026-08-08
- License: MIT
- Intended capability:
  - `web.template.validate.v1`

### Template dependency

Nuclei's engine license and the template corpus are reviewed separately.

- Template repository: `projectdiscovery/nuclei-templates`
- Reviewed license: MIT
- Runtime decision: never execute a moving `main` checkout
- Current upstream corpus release observed during 2026-09-18 re-review: `v10.4.7`
- This observed release is not an enablement pin. Hosted execution still requires an exact reviewed commit/tag, upstream checksum, and ScopeForge allowlist digest.
- Required before enablement:
  - pin an exact template repository commit
  - record upstream `templates-checksum.txt`
  - calculate and record ScopeForge's allowlisted-template-set digest
  - preserve template ID, source commit, and digest in result provenance

Current template snapshot status: **pinned for the initial one-template runtime slice** to nuclei-templates `v10.4.7`, commit `83234ce456da3e90dda86dfbc5e605e64a846df3`. The initial allowlist contains only `http-missing-security-headers` at Git blob `7c1c5b8191ddf3468348b8f8a046b4d61b75d319`. Broader profiles remain disabled. Production execution is still blocked on dedicated target-bound containment and operational acceptance.

### Template safety policy

The first Nuclei slice is safe-active and allowlist-only.

The initial allowlist must exclude any template requiring broader execution authority, including:

- `code` protocol
- JavaScript execution
- headless/browser execution
- fuzzing/DAST mutation
- file/local-host access
- arbitrary helper/process execution
- templates that intentionally mutate target state
- templates requiring out-of-band callback infrastructure unless separately designed and approved
- workflows that can escape the selected reviewed template set

Nuclei v3.11.0 introduced mandatory signing for JavaScript templates, but ScopeForge's first slice still excludes JavaScript templates rather than treating signing as sufficient authority.

### Supply-chain policy

Before runtime enablement:

1. pin Nuclei `v3.11.1` or a later separately reviewed release
2. record the release artifact SHA-256
3. pin the allowlisted template snapshot and checksum
4. build a reproducible worker image
5. record its immutable image digest
6. disable Nuclei self-update/template auto-update in execution workers
7. fail closed on engine or template version drift
8. preserve engine version and template digest in normalized observation provenance

Reviewed Nuclei v3.11.1 release metadata pins Linux amd64 SHA-256 `ea63d4ae232808cd7c6bc00d0142428e231fab59dae01042246097d195835ab6` and Linux arm64 SHA-256 `8044e3d9768ba0a744b2872c1a87e813006f013da97ca9f50f7661a4203bec07`. No production Nuclei worker is enabled.

## Nmap

### Identity

- Upstream: `nmap.org`
- Reviewed release: `7.991`
- Release date: 2026-08-06
- License: Nmap Public Source License (NPSL)
- Potential capabilities:
  - `network.port.discover.v1`
  - `network.service.fingerprint.v1`

### Licensing decision

Nmap is not treated like an MIT dependency.

The NPSL contains specific terms around redistribution, proprietary products, and externally deployed services. The annotated NPSL states that an externally deployed system designed to run Nmap scans should, where technically feasible, display a notice crediting the Nmap Security Scanner and linking to or naming `nmap.org`.

ScopeForge therefore will **not bundle or redistribute Nmap in its worker images, application packages, installers, or artifacts under this review**.

Before any hosted Nmap execution is enabled, a separate acceptance must determine:

- whether ScopeForge's intended deployment model is compatible with the NPSL
- required user-facing attribution
- whether operator-supplied/system-installed Nmap is acceptable
- whether an OEM license would be required for any future commercial distribution model
- Npcap implications if Windows support is ever introduced

No conclusion in this engineering document substitutes for legal advice.

### Supply-chain policy

If Nmap later receives explicit licensing approval:

1. pin the exact approved Nmap release
2. acquire it only through the approved installation/distribution model
3. record artifact/package checksums
4. record worker image digest if packaging becomes licensed
5. prohibit NSE script selection by callers
6. allow only a reviewed internal argument set
7. record Nmap version and scan profile identity in result provenance

Current checksum status: **N/A because ScopeForge does not acquire or redistribute Nmap at this stage**.

## Provider ordering

The preferred implementation order after this review is:

1. bounded httpx adapter and execution-contract tests for `web.http.probe.v1`
2. dedicated target-bound worker containment acceptance for the httpx slice
3. reviewed Nuclei adapter with a pinned safe-active template allowlist
4. dedicated Nuclei containment acceptance
5. Nmap only after its separate licensing/distribution decision

This order is intentionally different from simply integrating the most powerful scanner first. It minimizes new authority while proving the provider framework.

## Mandatory adapter invariants

Every external provider adapter must enforce:

- exact capability ID and provider version
- exact authorized target binding
- exact execution mode
- closed request schema with unknown-field rejection
- no arbitrary provider-native flags
- request/rate/runtime ceilings
- bounded stdout/stderr and normalized output
- deterministic parser failure behavior
- cancellation that terminates the underlying process tree
- output provenance containing provider and version
- no secrets or raw credentials in normalized observations
- no provider result directly confirms a finding
- cleanup is explicit and idempotent
- provider execution never occurs in planner/policy packages

## Runtime enablement gate

An adapter may exist in source while remaining unavailable in production.

A provider cannot become runtime-enabled until all of the following are true:

- dependency review complete
- exact artifact/template checksums recorded
- adapter contract tests green
- hostile output/parser tests green
- dedicated worker execution class reviewed
- real Linux containment acceptance complete
- cancellation/child-process termination proven
- egress scope proven
- CPU/memory/PID/disk/runtime ceilings proven
- secret/log leakage tests green
- exact-candidate CI green
- runtime feature flag remains default-off until the explicit enablement decision

## Reviewed upstream references

- Nmap NPSL: https://nmap.org/npsl/
- Nmap annotated NPSL: https://nmap.org/npsl/npsl-annotated.html
- Nmap changelog: https://nmap.org/changelog.html
- Nuclei: https://github.com/projectdiscovery/nuclei
- Nuclei releases: https://github.com/projectdiscovery/nuclei/releases
- Nuclei templates: https://github.com/projectdiscovery/nuclei-templates
- httpx: https://github.com/projectdiscovery/httpx
- httpx releases: https://github.com/projectdiscovery/httpx/releases
