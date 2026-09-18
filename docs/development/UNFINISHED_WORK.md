# ScopeForge Unfinished Work

Last reconciled: 2026-09-18, Asia/Singapore.

## Next implementation

Phase 11 Task 11: add deterministic graph-expansion and policy/approval fixture coverage. PR #130, PR #132, and PR #134 already cover two-stage discovery, replay, cancellation, authorization expiry, request budget, provider failure, labeled accuracy, attack paths, remediation retests, reproducibility, and local safety counters.

## Separately gated

- Do not apply the Phase 11 planning graph, run orchestration, or hardening migrations to production.
- Do not enable external Phase 11 provider execution.
- Review provider licenses, supply chain, adapters, and Linux containment before Nmap, Nuclei, HTTP discovery, or other providers.
- Existing Supabase advisor follow-ups, including leaked-password protection, remain separate work.

## Completed; do not repeat

- Issue #79's provider canaries and the production releases for Phase 10A2 and Phase 10A3.
- Phase 11 Tasks 1 to 9.
- Task 11's two-stage fixture, evaluation matrix, and labeled accuracy/attack-path/remediation fixture.
