# ScopeForge Next Steps

Last reconciled: 2026-09-19, Asia/Singapore.

1. Require exact-head CI for PR #147, then merge it.
2. Merge the default-off worker-host configuration slice; do not add production environment values as part of the source merge.
3. Install only the accepted immutable image digest and prove class-specific worker authentication, idle operation, rollback, and production migration ordering before a bounded enablement window.
4. Re-read the live Supabase ledger immediately before applying the reviewed Phase 11 migrations.
5. Keep external Nmap, Nuclei, and httpx process execution disabled.

Issue #79 is closed; Phase 10A2 PR #76 and Phase 10A3 PR #77 are released. Do not re-run their completed production acceptance as ordinary follow-up work.
