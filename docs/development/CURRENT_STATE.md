# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform for developers first, while making security findings understandable to people without a security background.

The product loop is:

`Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`

The approved long-term architecture is documented in `docs/superpowers/specs/2026-08-24-community-platform-design.md`.

## Phase 1 foundation

- Next.js 15 and React 19 application shell
- responsive landing, authentication, and dashboard UI
- Supabase authentication integration
- automatic profile and initial workspace onboarding
- multi-tenant workspace membership roles
- Row Level Security on exposed tables
- server-side Supabase session refresh
- baseline HTTP security headers
- GitHub Actions validation
- dedicated ScopeForge Supabase project in `ap-southeast-1`

## Phase 2 implementation

Phase 2 Asset Control is implemented on PR #4 and is pending final merge validation.

Implemented:

- workspace-scoped web application, API, and public GitHub repository assets
- canonical target normalization
- private, local, special-use, and IPv4-mapped IPv6 target rejection
- hosted verification limited to HTTPS port 443
- proof-of-control challenge tokens stored as SHA-256 hashes
- one active verification challenge per asset with revocation history
- DNS validation plus IP-pinned HTTPS verification to close DNS-rebinding/TOCTOU gaps
- 5-second request timeout and 4 KiB response limit
- manual redirect rejection
- workspace and per-asset verification quotas
- database-level quota enforcement for burst/concurrent requests
- append-only audit records written through trusted server paths
- authenticated client reads protected by RLS
- security-sensitive Phase 2 writes restricted to trusted server actions
- explicit owner/admin/member write authorization with viewer rejection
- database constraints that bind asset IDs to workspace IDs
- live asset inventory, registration, verification, detail pages, and dashboard counts
- scan-job metadata that remains blocked while active scanning is disabled
- permanent project handoff and test-status documentation

## Current security boundary

The browser can read only workspace-scoped Phase 2 records allowed by RLS. Direct authenticated INSERT, UPDATE, and DELETE access to security-sensitive Phase 2 tables is revoked. Mutations are performed by authenticated server actions after resolving the caller, workspace, and role, then use the server-only Supabase credential for the trusted write.

Hosted proof-of-control does not mean ownership. It demonstrates control of the configured target at verification time and is a prerequisite for future remote testing.

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

## Known Phase 2 limitations

- Active security scanning is intentionally disabled.
- Repository assets do not yet have proof-of-control verification. A GitHub integration is planned for a later phase.
- Hosted HTTP proof-of-control supports HTTPS port 443 only.
- Production asset mutations require `SUPABASE_SECRET_KEY` in the server environment.
- Cloudflare R2 is deferred to Phase 3.

## Safety boundary

ScopeForge is designed for owned systems, security labs, and explicitly authorized assessments. The public control plane must not become an unrestricted request proxy. Active security testing is introduced only after proof-of-control, quotas, SSRF controls, isolation, and bounded execution are in place.
