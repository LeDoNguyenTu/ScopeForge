# ScopeForge Implementation Log

## 2026-08-24 - Community platform direction
- Approved the community security platform direction and Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify loop.

## 2026-08-24 - Phase 2 Asset Control
- Added workspace-scoped assets, proof-of-control, authorization, SSRF defenses, quotas, audit records, and asset UI.
- Merged through PR #4.

## 2026-08-24 - Phase 3 design
- Approved and merged PR #5 defining the local/passive code and supply-chain scanner architecture.

## 2026-08-24 - Phase 3A Scanner Foundation
- Added normalized findings, stable fingerprints, bounded hostile-repository inventory, scanner coordination, and deterministic JSON.
- Hardened file-count traversal and double-star ignore semantics with dedicated RED/GREEN regressions.
- Merged through PR #6.

## 2026-08-24 - Phase 3B Safe Reads, Configuration, Policy, and CLI
- Added the shared safe inventory-entry reader, strict root config, safe policy/exit semantics, terminal/JSON CLI, safe output writing, and compiled CLI validation.
- Security review fixed configured output traversal/symlink overwrite and silent unknown-scanner configuration with dedicated RED/GREEN regressions.
- Merged through PR #7 as `d1ca23c5df0bc4ed2276f37b585db453a30b41c0`.

## 2026-08-24 - Phase 3C Secret Scanner
- Created isolated branch `feat/phase-3c-secret-scanner` and PR #8.
- CI #96 established the initial RED contract while the existing 89 tests remained green.
- Added mandatory redaction for provider, generic, and private-key findings.
- Added stable one-way `sfs1:` secret fingerprints that never serialize raw secret values.
- Added high-confidence GitHub, Stripe live, Slack, complete private-key block, and contextual high-entropy assignment rules.
- Added exact safe-fixture annotation suppression and fingerprint allowlisting.
- Registered `secrets` as the first built-in CLI scanner and exposed its five rules through `rules list`.
- Added fail-closed validation for unknown built-in rule IDs.
- Hardened inventory reads so the file-byte ceiling is enforced during the actual read, followed by a final identity/size check.
- Added end-to-end terminal/JSON no-leak regression coverage.
- Security review fixed private-key location metadata, incomplete private-key block false positives, and annotation scope leaking into the following line with dedicated RED/GREEN regressions.
- Final exact-head verification remained green and PR #8 was squash merged as `ee2b18c37d264fc22e47e650970e66d01f7c92dd`.

## 2026-08-24 - Phase 3D JavaScript/TypeScript Structural SAST
- Added execution-free JS/TS parsing, structured per-file diagnostics, bounded AST traversal, stable semantic fingerprints, and normalized source-safe evidence.
- Added narrow `jsts/dynamic-code-execution` and statically proven Node HTTPS TLS-verification rules.
- Removed an early insecure-cookie rule rather than ship receiver-name heuristics, then hardened module/global shadowing and type-only import behavior with dedicated RED/GREEN regressions.
- Final CI #178 passed 30 test files / 143 tests, strict typecheck, CLI compilation/runtime smoke, and production build.
- Merged through PR #9.

## 2026-08-24 - Phase 3E Bounded Command Taint Analysis
- Added high-confidence Express request-source to Node `child_process.exec` / `execSync` data flow.
- Kept propagation bounded to supported intra-file/intra-handler flows with conservative mutation, shadowing, sanitizer, unsupported-control-flow, and taint-budget behavior.
- Final head passed runtime tests, strict typecheck, CLI build/runtime, production build, and CI #203.
- Merged through PR #10.

## 2026-08-24 - Phase 3F Dependency and OSV Scanning
- Added bounded npm dependency inventory across package-lock, npm-shrinkwrap, pnpm-lock, yarn.lock, and package.json fallback.
- Preferred resolved lockfile versions, normalized npm package URLs, and added optional OSV query-batch enrichment with pagination, caching, and structured lookup-failure diagnostics.
- Kept OSV disabled by default so local dependency inventory remains deterministic and offline-capable.
- Merged through PR #11.

## 2026-08-24 - Phase 3G CycloneDX SBOM
- Added CycloneDX 1.7 JSON SBOM generation using the maintained CycloneDX JavaScript library.
- Added root/dependency components, purls, direct dependency relationships, deterministic ordering, tool metadata, and `--sbom` output through the safe writer.
- Kept SBOM generation independent of OSV/network availability and repository code execution.
- Merged through PR #12.

## 2026-08-24 - Phase 3H Docker IaC Scanning
- Added a bounded Dockerfile logical-instruction parser and conservative checks for floating base images, explicit effective root user, remote ADD, download-pipe-shell, and world-writable permissions.
- Avoided noisy missing-USER claims because inherited base-image metadata is unavailable locally.
- Registered the `iac` scanner without executing Dockerfiles, RUN commands, images, shells, package managers, or registry/network lookups.
- Merged through PR #13.

## 2026-08-24 - Phase 3I Kubernetes IaC Scanning
- Added bounded structural multi-document YAML parsing with document and alias limits.
- Added high-confidence workload, host namespace/path, privilege, capability, root-user, writable-root-filesystem, service-account token, and wildcard RBAC checks.
- Kept scanning local with no cluster access, schema downloads, Helm/Kustomize, kubectl, or repository execution.
- Merged through PR #15.

## 2026-08-24 - Phase 3J Terraform IaC Scanning
- Added local HCL parsing through the HashiCorp CDK WebAssembly parser with bounded block counts.
- Added conservative AWS security-group ingress, public RDS, disabled storage encryption, public S3 ACL/public-access-block, and wildcard IAM policy-document rules.
- Added no-execution/no-network security regressions covering Terraform CLI, providers/modules, provisioners, external data sources, and cloud APIs.
- Final CI #266 passed 64 test files / 260 tests plus strict typecheck, CLI build/runtime, and production build.
- Merged through PR #16.

## 2026-08-24 - Phase 3K GitHub Actions IaC Scanning
- Added bounded structural workflow YAML analysis for untrusted shell interpolation, `write-all`, mutable third-party action refs, dangerous `pull_request_target` chains, self-hosted PR execution, and persisted broad write credentials.
- Restricted workflow routing to `.github/workflows/*.yml|yaml` and kept workflow/action/shell/network execution disabled.
- Final CI #275 passed 68 test files / 275 tests plus strict typecheck, CLI build/runtime, and production build.
- Merged through PR #17.

## 2026-08-24 - Phase 3L Baseline Model
- Added deterministic version 1 baselines with stable fingerprints and safe metadata only.
- Added 4 MiB / 50,000-entry limits, strict exact-key schema validation, no-follow identity-checked reads, symlink refusal, and root-contained repository baseline paths.
- Added `baseline create`, `--baseline`, new/existing classification, resolved-entry tracking, new-only gating by default, and explicit `--baseline-gate all`.
- Security regressions prevent evidence, source snippets, arbitrary metadata, remediation text, or secret values from entering baseline artifacts.
- Final exact-head CI #292 passed the complete validation gate after deterministic-order hardening.
- Merged through PR #18 as `6b349b9a07a060d371f5ccf9fccb670e8ddbc1eb`.

## 2026-08-24 - Phase 3M Generic Configuration Security
- Added `.npmrc` configuration inventory and an effective last-setting-wins `strict-ssl=false` rule.
- Added structural `vercel.json` wildcard `Access-Control-Allow-Origin: *` detection.
- Kept evidence generic, fingerprints line-movement-resistant, and configuration scanning free of package-manager/framework/shell/repository execution and scanner-initiated network access.
- Exact-head CI #301 passed the full runtime, typecheck, CLI, and production-build gate.
- Merged through PR #19 as `474bd82a1cad014e796a7faf83369c09f0d3dfc5`.

## 2026-08-24 - Phase 3N SARIF Output
- CI #303 established the intentional RED contract while 78 existing test files / 308 existing tests remained green; failures were limited to missing SARIF serialization and format integration.
- Added deterministic SARIF 2.1.0 output for GitHub Code Scanning with stable rule IDs, deterministic rule indexes, existing ScopeForge fingerprints in `partialFingerprints`, severity mapping, and baseline-state continuity.
- Added `%SRCROOT%` repository-relative locations while omitting unsafe absolute, traversal, backslash, or drive-letter locations without dropping findings.
- Added a fixed SARIF property allowlist and regressions preventing secret material, arbitrary metadata, source snippets, data-flow labels, and local scan-root paths from entering SARIF.
- Added `--format sarif` and root-configured SARIF output through the existing safe output and policy pipeline.
- CI #308 passed 82 test files / 320 tests, strict typecheck, CLI compilation, compiled `ScopeForge 0.1.0` smoke, and production build.
- Final exact-head documentation verification and merge remain pending.

## Current boundary

Phase 3 remains local and passive. The scanner now includes normalized findings, bounded repository reads/inventory, secret detection, JS/TS structural SAST and bounded command taint analysis, dependency inventory with optional OSV enrichment, CycloneDX SBOM output, Docker/Kubernetes/Terraform/GitHub Actions/configuration analysis, baselines, terminal output, native JSON, and SARIF 2.1.0. Phase 3N is pending its documentation-head verification and merge. The remaining Phase 3 work is release hardening: end-to-end integration and hostile-repository coverage, benchmark/performance validation, CI and user documentation, final security review, and release-readiness sign-off. Remote DAST, fuzzing, exploitation, credential attacks, persistence, and destructive actions remain outside Phase 3.
