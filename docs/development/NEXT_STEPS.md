# ScopeForge Next Steps

## Current phase: Phase 2 - Asset Control

Phase 2 implementation is complete on PR #4 and is at the final merge gate.

Immediate actions:

1. Run GitHub CI on the final documentation and migration-synchronization head.
2. Confirm Supabase security advisor remains clean.
3. Confirm performance advisor reports only acceptable unused-index INFO notices.
4. Mark PR #4 ready for review.
5. Squash merge PR #4 into `main` after green CI.
6. Reset the Phase 2 working branch to the squash commit so public branch history remains concise.

## After Phase 2 merge

Begin a separate Phase 3 design cycle for code security. The intended scope is passive and code-local first:

- dependency inventory and OSV-backed vulnerability checks
- CycloneDX SBOM generation
- secret detection
- static security rules
- Dockerfile, Kubernetes, and Terraform policy checks
- Cloudflare R2 artifact storage
- a normalized first-generation finding model

Phase 3 must remain independently testable and should not introduce remote active exploitation.

## Deployment prerequisites before a public trial

- connect the final Vercel project to the GitHub repository
- configure the public Supabase URL/key and server-only `SUPABASE_SECRET_KEY`
- attach `scopeforge.dev` and complete DNS/TLS validation
- add Cloudflare Turnstile before opening sign-up broadly
- validate production auth redirects and asset registration on the deployed origin

## Phase boundary

Do not begin remote DAST, API fuzzing, exploit validation, or generalized network scanning until the later execution-plane phases have isolated workers, explicit scopes, egress controls, budgets, and cancellation semantics.
