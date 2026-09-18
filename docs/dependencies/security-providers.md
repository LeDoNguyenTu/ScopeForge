# Security Provider Dependency Register

Last reviewed: 2026-09-18

This register controls Phase 11 external security providers. A provider is not enabled merely because an adapter exists in the repository.

## Nmap

- Provider ID: `nmap`
- ScopeForge adapter pin: `7.991`
- Upstream stable version reviewed: Nmap 7.991, released 2026-08-06
- Upstream: https://nmap.org/
- License: Nmap Public Source License (NPSL)
- License reference: https://nmap.org/npsl/
- Distribution decision for initial ScopeForge integration: do not vendor or redistribute Nmap in the repository, npm package, Vercel deployment, or worker image
- Execution model: operator-installed executable in a dedicated Linux worker, version checked before admission
- Official source artifact: `nmap-7.991.tar.bz2`
- Official integrity material: https://nmap.org/dist/sigs/nmap-7.991.tar.bz2.digest.txt and detached PGP signature from the same release directory
- ScopeForge artifact checksum: not applicable while Nmap is not vendored; a future worker image must record the exact package/image digest in this file before enablement
- Update rule: no floating latest version. A version bump requires license review, upstream changelog/security review, updated containment acceptance, parser fixtures, and an explicit dependency-register change.
- Hosted attribution requirement: if Nmap is externally deployed by ScopeForge, surface the required Nmap attribution and link where technically feasible.

Important: the NPSL contains redistribution/embedding conditions that differ from ordinary permissive OSS licenses. Any future bundled/containerized distribution must be reviewed before release. Commercial redistribution may require an OEM license.

## ProjectDiscovery Nuclei

- Provider ID: `nuclei`
- ScopeForge adapter pin: `3.11.1`
- Upstream release reviewed: `v3.11.1`, released 2026-08-08
- Upstream: https://github.com/projectdiscovery/nuclei
- Release commit shown by upstream: `a8c88fe`
- License: MIT
- Distribution decision for initial ScopeForge integration: adapter may target the pinned CLI, but hosted runner packaging remains separately gated
- Integrity policy: worker image/binary digest must be recorded here before hosted execution is enabled; do not use `latest`
- Update rule: review release notes and security changes, then rerun provider parser/containment acceptance before changing the pin

Nuclei v3.10 and v3.11 contain security hardening around template capabilities and signed JavaScript templates. ScopeForge does not treat those upstream protections as sufficient by themselves. The initial profile remains more restrictive: reviewed HTTP templates only, with JavaScript, code, headless, file, workflow, fuzz/DAST, and OAST capabilities disabled.

## Nuclei templates

- Upstream: https://github.com/projectdiscovery/nuclei-templates
- License: MIT
- Update mode: pinned reviewed manifest only, never automatic runtime update
- Current corpus release observed during review: v10.4.6 was published 2026-07-16; before external execution is enabled, re-check the current upstream release and pin the exact commit/tag used by the reviewed manifest
- Integrity input: upstream `templates-checksum.txt` plus a ScopeForge-owned manifest hash
- ScopeForge policy: each enabled template ID must exist in a code-reviewed profile manifest; a template ID outside the manifest is rejected during normalization
- Automatic `-ut` / template update: disabled in hosted workers

## ScopeForge HTTP discovery

- Provider ID: `scopeforge.http-discovery`
- Version: `1.0.0`
- Upstream dependency: none
- License: repository license
- Distribution: first-party code
- Update rule: normal ScopeForge review plus containment acceptance when network behavior changes

## Enablement checklist

A provider remains disabled until all boxes are satisfied:

- [ ] exact executable or image digest recorded
- [ ] license/distribution decision reviewed for the actual deployment shape
- [ ] Linux containment acceptance passes
- [ ] parser and normalization fixtures pass
- [ ] cancellation and timeout cleanup pass
- [ ] target authorization binding passes
- [ ] evidence retention/redaction passes
- [ ] runtime feature flag remains default-off until explicit hosted validation
