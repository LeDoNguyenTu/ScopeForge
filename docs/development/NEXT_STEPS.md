# ScopeForge Next Steps

Last reconciled: 2026-09-21, Asia/Singapore. Live provider state wins over this document.

## Immediate Phase 11 closure

1. From an authenticated platform-admin session at `/admin/phase11`, run exactly one verified ScopeForge-owned HTTPS root-only `web.http.probe.v1` canary.
2. Keep redirects disabled, request ceiling at one, and action runtime ceiling at 5000 ms.
3. Verify the dedicated worker leases the task, preparation passes the former HTTP 409 boundary, and mediator/sandbox execution occurs normally.
4. Verify exactly one request, a valid terminal attempt, terminal run/action/task reconciliation, and either a valid observation or legitimate no-signal result.
5. Verify coverage request-count delta is exactly one, no duplicate terminal accounting occurs, and ordinary logs/evidence contain no response body, credential, authorization token, or secret.
6. Verify the accepted Oracle host leaves no Phase 11 runtime container or mediator socket behind.
7. Record the exact production evidence, remove `public/.well-known/scopeforge-verification.txt`, update the Phase 11 completion/status docs, and mark Phase 11 operationally complete only after all acceptance criteria pass.

## Current released facts

- Phase 11 source Tasks 1 through 16 are complete for the initial approved scope.
- The latest runtime-changing Phase 11 baseline is PR #164 at `3cc1443ed292a14fe6738bc64a0b8629b5992d56`; later documentation-only commits may move `main`.
- PR #163 released the Unix-socket pathname-length fix.
- PR #164 released the post-claim preparation-state fix.
- The dedicated `phase11_http_discovery_v1` worker is enabled and production logs show repeated authenticated idle claim HTTP 200 responses.
- Three failed production canaries remain preserved as audit evidence. Do not retry, rewrite, or delete them.
- ScopeForge production has one eligible verified HTTPS canary target: `https://scopeforge.dev`.
- External Nmap, Nuclei, external httpx, broad exploit frameworks, and deferred advanced Task 16 providers remain disabled until separately reviewed.

## Parallel non-Phase-11 work

Safe maintenance and hardening work that does not widen execution authority may proceed independently, including database index hardening, documentation reconciliation, UI/read-model improvements, and security review. Do not use unrelated maintenance as justification to lower the Phase 11 acceptance gate.

## Already complete and not to be repeated

- Phase 10A2 and Phase 10A3 production acceptance is released.
- Phase 10C platform-admin console is released.
- Reviewed Phase 11A/11C/11F migrations are already present in production Supabase.
- Worker registration, immutable runtime-image acceptance, authenticated empty claims, and class-scoped rollback are already proven.
