# ScopeForge Next Steps

Last reconciled: 2026-09-22, Asia/Singapore. Live provider state wins over this document.

## Immediate Phase 11 closure

1. Keep exact-main deployment `dpl_46A1x9oNBJW9G1shiKEDTb7D7eQc` and migration `20260922150155` compatible; do not roll production back to pre-fix application code while the mapping remains active.
2. In a separately authorized future run, queue exactly one new verified ScopeForge-owned HTTPS root-only `web.http.probe.v1` canary.
3. Keep redirects disabled, request ceiling at one, and action runtime ceiling at 5000 ms.
4. Require `acceptance_ready = true`, then repeat Vercel secrecy and Oracle cleanup checks.
5. Only after that acceptance, remove `public/.well-known/scopeforge-verification.txt` and mark Phase 11 operationally complete.

The current single-Codex run already used its one canary. Do not queue another in that run.

## Current released facts

- Phase 11 source Tasks 1 through 16 are complete for the initial approved scope.
- The latest runtime-changing Phase 11 baseline is PR #164 at `3cc1443ed292a14fe6738bc64a0b8629b5992d56`; later documentation-only commits may move `main`.
- PR #163 released the Unix-socket pathname-length fix.
- PR #164 released the post-claim preparation-state fix.
- The dedicated `phase11_http_discovery_v1` worker is enabled and production logs show repeated authenticated idle claim HTTP 200 responses.
- Three dead-letter canaries plus the fourth failed parent run remain preserved as audit evidence. Do not retry, rewrite, or delete them.
- ScopeForge production has one eligible verified HTTPS canary target: `https://scopeforge.dev`.
- External Nmap, Nuclei, external httpx, broad exploit frameworks, and deferred advanced Task 16 providers remain disabled until separately reviewed.

## Parallel non-Phase-11 work

Safe maintenance and hardening work that does not widen execution authority may proceed independently, including database index hardening, documentation reconciliation, UI/read-model improvements, and security review. Do not use unrelated maintenance as justification to lower the Phase 11 acceptance gate.

## Already complete and not to be repeated

- Phase 10A2 and Phase 10A3 production acceptance is released.
- Phase 10C platform-admin console is released.
- Reviewed Phase 11A/11C/11F migrations are already present in production Supabase.
- Worker registration, immutable runtime-image acceptance, authenticated empty claims, and class-scoped rollback are already proven.
