# ScopeForge Next Steps

Last reconciled: 2026-09-23, Asia/Singapore. Live GitHub/provider state wins.

## Active post-v1 roadmap

The approved ScopeForge v1 roadmap remains complete at 11 of 11 phases.

The user has now explicitly adopted Phase 12, **External provider runtime and automated pentest expansion**, as new post-v1 scope.

Current estimated broader automated-pentest product vision: approximately 75% at Phase 12 start.

Active slice: **12A external ProjectDiscovery httpx**.

The product UX/account-security hardening and rendered mobile-navigation follow-up shipped in PRs #186 and #187. Continue Phase 12 without changing its runtime gates.

See:

- `docs/development/PHASE12_ROADMAP.md`
- `docs/development/PHASE12_CURRENT_STATE.md`

## Execution order

1. 12A external httpx contract, worker runtime, containment and production acceptance.
2. 12B Nuclei allowlist-only runtime.
3. 12C network/service discovery with Nmap or a reviewed provider-neutral alternative.
4. 12D hosted authenticated browser/API runtime.
5. 12E bounded web/API DAST.
6. 12F expanded proof-only validators.
7. 12G adaptive multi-provider orchestration/correlation.
8. 12H benchmarks, rollback, operational acceptance and closure.

Each network/process authority stays default-off until its own Linux containment and acceptance gate passes.

## Storage direction

Keep compact structured state in Supabase/Postgres. Put large or unstructured scan artifacts in private Cloudflare R2 with short-lived mediated access. Do not use Postgres as blob storage for raw provider output.

## Repository hygiene

The completed v1 cleanup preserved dirty, diverged, and intentional worktrees/branches. Recheck open PRs and `git worktree list` before future branch deletion.
