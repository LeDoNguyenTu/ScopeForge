# ScopeForge Implementation Log

## 2026-08-24 - Community platform direction

- Reframed ScopeForge from a portfolio-style AppSec project into an open-source community security platform.
- Approved the long-term product loop: Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify.
- Added the community-platform design specification and phased implementation plan.
- Established Security Story, Explain Mode, Prepare Mode, and future Security Packs as ScopeForge-specific product concepts.

## 2026-08-24 - Phase 2 Asset Control

- Repositioned the README and contributor documentation around the community security mission.
- Added permanent current-state, test-status, next-step, implementation-log, and session-handoff documents.
- Added Vitest and React Testing Library to the CI validation path.
- Added workspace-scoped assets, verification challenges, blocked scan-job metadata, audit events, and usage counters in Supabase.
- Added RLS read isolation and restricted Phase 2 security-sensitive writes to trusted server actions.
- Added explicit owner/admin/member write authorization and viewer rejection.
- Added canonical target normalization and public HTTPS-only verification boundaries.
- Added proof-of-control challenges using 256-bit random tokens with SHA-256 hashes stored in PostgreSQL.
- Added challenge revocation, one-active-challenge enforcement, attempt tracking, and replay reduction after success/final failure.
- Added IP-pinned HTTPS verification to close DNS-rebinding/TOCTOU risk after DNS validation.
- Added private, local, special-use, and IPv4-mapped IPv6 rejection, manual redirects, a 5-second timeout, and a 4 KiB response ceiling.
- Added application and database-level trial quotas, including concurrency-safe advisory locks.
- Added composite asset/workspace foreign keys so challenge and scan-job metadata cannot reference an asset in a different workspace.
- Added asset inventory, registration, detail, verification, audit activity, and live dashboard state.
- Verified cross-workspace RLS isolation and direct authenticated write denial using temporary transaction-scoped test identities.
- Ran Supabase security advisor with no lints and fixed composite foreign-key index notices from the performance advisor.
- Merged Phase 2 through PR #4.

## 2026-08-24 - Phase 3 code and supply-chain security design

- Approved and merged PR #5 defining the complete Phase 3 local/CI scanner architecture.
- Set local/passive scanning as the Phase 3 boundary with report-only CI by default and explicit future severity gating.
- Defined one finding contract for SAST, secrets, dependencies, IaC, configuration, baselines, JSON, SARIF, and later hosted ingestion.
- Defined hostile-repository boundaries that prohibit executing target code, lifecycle scripts, Dockerfiles, Terraform, Kubernetes manifests, and workflows.
- Defined the ordered implementation sequence from scanner contracts through detectors, baselines, SARIF, integration/security tests, and release review.

## 2026-08-24 - Phase 3A Scanner Foundation

- Created isolated branch `feat/phase-3a-scanner-foundation` and draft PR #6.
- Added a dedicated Phase 3A implementation plan.
- Used TDD: CI run #68 verified the five new scanner suites failed because production modules were intentionally absent.
- Added the normalized finding, evidence, remediation, scan-error, policy-result, and scan-result TypeScript contracts.
- Added `sf1:` SHA-256 fingerprints based on normalized scanner/rule/path/structural identity without raw-secret inputs.
- Added severity ordering and threshold helpers.
- Added bounded repository inventory with generated/vendor exclusions, root ignore files, symlink non-following, deterministic traversal, and byte/file budgets.
- Added lightweight source, manifest, lockfile, infrastructure, and configuration classification.
- Added a pluggable scanner interface and deterministic coordinator with fingerprint deduplication and explicit error capture.
- Added versioned deterministic ScopeForge JSON serialization.
- Kept scanner packages independent from Next.js, Supabase, and Vercel.
- Updated `docs/SECURITY.md` to document the current control-plane and local hostile-repository boundaries.
- Final security review found that the accepted-file budget still walked remaining siblings. Added a regression test in CI run #72, then stopped traversal at the file-count budget. CI run #73 passed 71 tests, typecheck, and build.
- Contract review found incomplete zero-directory `**` semantics. Added a regression test in CI run #75, fixed `**/` and trailing `/**` matching, and confirmed CI run #76 passed all 72 tests, typecheck, and production build.

## Current Phase 3 boundary

Phase 3 is local and passive. Secret scanning, JS/TS SAST, taint analysis, SCA/OSV, SBOM, IaC rules, baselines, SARIF, and CLI/policy behavior remain ordered Phase 3 work. Remote DAST, authenticated crawling, fuzzing, exploitation, credential attacks, persistence, and destructive actions remain outside Phase 3.

## Earlier foundation

- Created the dedicated ScopeForge Supabase project in Singapore.
- Added authentication, workspace tenancy, RLS, responsive application shell, security headers, and CI validation.
