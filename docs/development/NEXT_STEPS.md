# ScopeForge Next Steps

Last reconciled: 2026-09-24, Asia/Singapore. Live GitHub/provider state wins.

## Active post-v1 roadmap

The approved ScopeForge v1 roadmap remains complete at 11 of 11 phases.

The user has now explicitly adopted Phase 12, **External provider runtime and automated pentest expansion**, as new post-v1 scope.

Current estimated broader automated-pentest product vision: approximately 75% at Phase 12 start.

Active slice: **12A external ProjectDiscovery httpx**.

The product UX/account-security hardening, rendered mobile-navigation correction, TOTP recovery/QR corrections, role-scoped MFA enforcement, and scheduled maintenance controls shipped through PR #194. Continue Phase 12 without changing its runtime gates.

See:

- `docs/development/PHASE12_ROADMAP.md`
- `docs/development/PHASE12_CURRENT_STATE.md`

## Execution order

1. 12A external httpx: run `scripts/phase12-provider-linux-containment.sh` on the dedicated Linux/Oracle host using the exact merged source SHA and immutable httpx + sidecar image identities. Then verify the real host tunnel, pinned-IP dialing, byte/runtime budgets, process-tree cancellation and cleanup. Only after all containment gates pass should the dedicated worker/control-plane path be added and a bounded production canary considered.
2. 12B Nuclei: preserve the single-template default-off runtime foundation and reuse the same two-container target-bound sandbox only after Linux acceptance proves the shared boundary. Keep Nuclei disabled until its own operational gate passes.
3. 12C network/service discovery with Nmap or a reviewed provider-neutral alternative.
4. 12D hosted authenticated browser/API runtime.
5. 12E bounded web/API DAST.
6. 12F expanded proof-only validators.
7. 12G adaptive multi-provider orchestration/correlation.
8. 12H benchmarks, rollback, operational acceptance and closure.

Each network/process authority stays default-off until its own Linux containment and acceptance gate passes.

Frontend parity is now a parallel release requirement. Keep `/dashboard/security-runs` and `/admin/providers` synchronized with actual backend acceptance state as each Phase 12 provider advances. Never make a locked provider appear runnable merely because its adapter or sandbox source exists.

## Storage direction

Keep compact structured state in Supabase/Postgres. Put large or unstructured scan artifacts in private Cloudflare R2 with short-lived mediated access. Do not use Postgres as blob storage for raw provider output.

## Repository hygiene

The completed v1 cleanup preserved dirty, diverged, and intentional worktrees/branches. Recheck open PRs and `git worktree list` before future branch deletion.
