# ScopeForge Next Steps

Last reconciled: 2026-09-19, Asia/Singapore.

1. Release the Phase 11C exact-image Linux acceptance record.
2. Add a separate default-off hosted worker configuration for `phase11_http_discovery_v1` using only the accepted immutable image digest.
3. Prove class-specific worker authentication, idle operation, rollback, and production migration ordering before a bounded enablement window.
4. Keep external Nmap, Nuclei, and httpx process execution disabled.

Issue #79 is closed; Phase 10A2 PR #76 and Phase 10A3 PR #77 are released. Do not re-run their completed production acceptance as ordinary follow-up work.
