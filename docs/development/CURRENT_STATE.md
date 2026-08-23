# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform for developers first, while making security findings understandable to people without a security background.

The product loop is:

`Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`

The approved long-term platform architecture is documented in `docs/superpowers/specs/2026-08-24-community-platform-design.md`.

The approved Phase 3 local code and supply-chain scanner architecture is documented in `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`.

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

## Phase 2 Asset Control

Phase 2 is merged through PR #4.

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
- blocked scan-job metadata while active remote scanning remains disabled

## Phase 3A Scanner Foundation

Phase 3A is implemented on PR #6 and is pending final merge validation.

Implemented in the PR:

- framework-independent scanner module boundaries under `packages/`
- one normalized finding and scan-result contract
- severity ordering and threshold comparison helpers
- stable `sf1:` SHA-256 finding fingerprints based on normalized structural identity rather than line numbers alone
- a bounded repository inventory shared by later scanners
- default exclusion of generated/vendor directories
- root `.scopeforgeignore` and `.gitignore` matching
- symlink non-following behavior
- file-count, per-file-size, and total-byte scan budgets
- lightweight source, manifest, lockfile, infrastructure, and configuration classification
- pluggable scanner interface and deterministic scanner execution order
- finding deduplication by fingerprint
- explicit scanner error capture
- deterministic finding ordering
- versioned ScopeForge JSON envelope with canonical ordering
- test-first coverage for the above contracts and safety boundaries

The scanner foundation has no Next.js, Supabase, or Vercel dependency and introduces no remote scanning behavior.

## Current security boundary

The browser control plane retains the Phase 2 workspace/RLS/trusted-write boundary.

The Phase 3A local scanner foundation treats repository contents as hostile input. It does not execute repository code or project lifecycle scripts, does not follow symlinks, does not install target dependencies, and does not make scanner-originated network requests. Later detector families must consume the shared bounded inventory and normalized finding contract rather than bypassing these boundaries.

## Not shipped yet

- local CLI command family
- repository scanner configuration and explicit policy gates
- secret detection and redaction
- JavaScript/TypeScript AST SAST rules
- JavaScript/TypeScript taint analysis
- dependency vulnerability analysis and OSV enrichment
- CycloneDX SBOM generation
- Dockerfile security analysis
- Kubernetes security analysis
- Terraform security analysis
- GitHub Actions and generic configuration analysis
- baseline engine
- SARIF output and GitHub Code Scanning example
- hosted scanner-result ingestion and private artifact persistence
- remote DAST
- API fuzzing
- exploit validation
- background remote scanner workers
- Security Stories and risk graphs
- executable community Security Packs

Do not describe these as implemented until their implementation PRs are merged and validated.

## Safety boundary

ScopeForge is designed for owned systems, security labs, and explicitly authorized assessments. Phase 3 is local and passive. Remote DAST, authenticated crawling, API fuzzing, exploit validation, credential attacks, persistence, and destructive actions are outside Phase 3 and must not be introduced through local scanner work.
