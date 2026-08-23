# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform for developers first, while making security findings understandable to people without a security background.

The product loop is:

`Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`

The approved long-term architecture is documented in `docs/superpowers/specs/2026-08-24-community-platform-design.md`.

## Shipped foundation

- Next.js 15 and React 19 application shell
- responsive landing, authentication, and dashboard UI
- Supabase authentication integration
- automatic profile and initial workspace onboarding
- multi-tenant workspace membership roles
- Row Level Security on exposed Phase 1 tables
- server-side Supabase session refresh
- baseline HTTP security headers
- GitHub Actions validation for TypeScript and production builds
- dedicated ScopeForge Supabase project in `ap-southeast-1`

## In progress

Phase 2 introduces the first real security workflow boundary:

- workspace-scoped asset registration
- canonical target normalization
- proof-of-control challenges
- verification attempt limits
- audit events
- trial quotas
- scan-job metadata that remains blocked while active scanning is disabled

## Not shipped yet

- SAST
- secrets scanning
- dependency vulnerability analysis
- SBOM generation
- IaC scanning
- remote DAST
- API fuzzing
- exploit validation
- background scanner workers
- R2 artifact persistence
- Security Stories and risk graphs
- community Security Packs

Do not describe these as implemented until their implementation PRs are merged and validated.

## Safety boundary

ScopeForge is designed for owned systems, security labs, and explicitly authorized assessments. The public control plane must not become an unrestricted request proxy. Active security testing is introduced only after proof-of-control, quotas, SSRF controls, isolation, and bounded execution are in place.
