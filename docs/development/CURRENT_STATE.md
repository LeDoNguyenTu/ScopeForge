# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform for developers first, while making security findings understandable to people without a security background.

Product loop: `Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`.

The approved platform design is in `docs/superpowers/specs/2026-08-24-community-platform-design.md`. The approved local scanner architecture is in `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`.

## Shipped foundations

### Phase 1
- Next.js/React application shell
- Supabase authentication and workspace tenancy
- Row Level Security and server session handling
- security headers and CI

### Phase 2
- workspace-scoped web/API/public-GitHub assets
- canonical target normalization
- proof-of-control challenges
- public HTTPS verification with DNS/IP/SSRF boundaries
- trusted server-side writes, roles, quotas, audit records, and asset UI
- remote active scanning remains disabled

### Phase 3A
- normalized finding and scan-result contracts
- stable structural fingerprints
- severity helpers
- bounded deterministic repository inventory
- generated/vendor excludes, ignore patterns, symlink non-following, and file/byte budgets
- scanner coordinator, deduplication, explicit scanner errors, and deterministic JSON

### Phase 3B
Implemented on PR #7 pending final merge validation:

- safe inventory-entry content reads with containment, no-follow, regular-file, inode/device, and size revalidation
- strict root-only `.scopeforge.json` configuration schema version 1
- repository configuration may tighten but not raise safe inventory budgets
- configured scanner families, rule include/exclude metadata, output preferences, and `failOn` policy contract
- unknown configured scanner families fail closed
- report-only default and inclusive explicit severity gates
- baseline-compatible policy behavior that does not fail on `existing` findings
- stable exit codes: 0 success, 1 policy failed, 2 usage/configuration, 3 scanner execution error
- local CLI commands for `scan`, `rules list`, and `version`
- terminal and deterministic JSON output
- no-follow output writer and containment for repository-configured output paths
- dedicated CLI TypeScript build and CI runtime smoke test

No detector family is registered yet. A clean Phase 3B scan means the repository inventory and scanner shell executed successfully, not that SAST/secrets/SCA/IaC analysis has been performed.

## Not shipped yet

- secret scanner and redaction primitives
- JavaScript/TypeScript AST SAST and taint analysis
- dependency/OSV analysis and CycloneDX SBOM
- Docker/Kubernetes/Terraform/GitHub Actions rules
- baseline file engine
- SARIF adapter
- hosted scanner-result ingestion
- remote DAST, API fuzzing, exploit validation, or scanner workers

## Safety boundary

Phase 3 is local and passive. Detector families must use the shared bounded inventory and safe read path. Remote active testing remains a later phase with separate authorization, isolation, egress, quota, and cancellation requirements.
