# ScopeForge Unfinished Work

Last reconciled: 2026-09-18, Asia/Singapore.

## Next implementation

Phase 11 Task 11: extend the adaptive end-to-end evaluation harness. PR #130 provides the first deterministic two-stage fixture and measured safety manifest; add the remaining labeled coverage, expiry, replay, cancellation, budget, and provider-failure cases.

## Separately gated

- Do not apply the Phase 11 planning graph, run orchestration, or hardening migrations to production.
- Do not enable external Phase 11 provider execution.
- Perform provider license, supply-chain, adapter, and Linux containment review before adding Nmap, Nuclei, HTTP discovery, or other providers.
- Existing Supabase advisor notices remain follow-up work; leaked-password protection is still disabled.

## Completed; do not repeat

- Phase 10A2 private repository scanning and Phase 10A3 webhook reconciliation
- Phase 11 Tasks 1 to 9, including persistence and trusted run orchestration
- Exact-head CI, Vercel, production deployment, migration boundary, browser/security checks, and Codex Security scan for PR #128
