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
- Confirmed the latest implementation checkpoint passes unit tests, TypeScript typecheck, and Next.js production build.

## Phase 2 boundary

Active scanning remains disabled. Repository proof-of-control, R2 artifacts, SAST, SCA, SBOMs, IaC analysis, DAST, API fuzzing, exploit validation, and isolated scanner workers remain later-phase work.

## Earlier foundation

- Created the dedicated ScopeForge Supabase project in Singapore.
- Added authentication, workspace tenancy, RLS, responsive application shell, security headers, and CI validation.
