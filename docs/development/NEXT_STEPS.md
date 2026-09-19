# ScopeForge Next Steps

Last reconciled: 2026-09-19, Asia/Singapore.

1. On the dedicated Oracle host, use only the accepted immutable Phase 11 runtime image digest and start the already registered `phase11_http_discovery_v1` worker.
2. Prove authenticated idle claim/heartbeat without scheduling a target action.
3. Exercise a class-scoped rollback that disables/stops only the Phase 11 HTTP worker.
4. Run one bounded authorized production canary.
5. Verify terminal cleanup, request accounting, result-to-coverage reconciliation, cancellation/recovery, and logs.
6. Leave the Phase 11 HTTP class enabled only after the canary and rollback checks pass.
7. Keep external Nmap, Nuclei, and external httpx process execution disabled until separately reviewed.

Already complete and not to be repeated:

- PR #147 merged and passed exact-head CI.
- Vercel production is READY on current `main`.
- The reviewed Phase 11A/11C migrations are already present in production Supabase.
- A Phase 11 HTTP worker identity is already registered.

Issue #79 is closed; Phase 10A2 PR #76 and Phase 10A3 PR #77 are released. Do not re-run their completed production acceptance as ordinary follow-up work.
