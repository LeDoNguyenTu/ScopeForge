# ScopeForge Test Status

This file records the latest verified state. Update it before ending a development session that changes product behavior or security boundaries.

| Check | Result | Evidence / notes |
|---|---|---|
| GitHub Actions unit tests | Passing at implementation checkpoint | `npm test` passed after Phase 2 authorization and SSRF hardening; the final PR head must pass the same suite before merge |
| TypeScript typecheck | Passing at implementation checkpoint | `npm run typecheck` passed after Phase 2 authorization and SSRF hardening; the final PR head must pass again before merge |
| Next.js production build | Passing at implementation checkpoint | `npm run build` passed after Phase 2 authorization and SSRF hardening; the final PR head must pass again before merge |
| Target-normalization tests | Passing | Includes private/local targets, IPv6 loopback, IPv4-mapped IPv6, HTTPS-only and port-443 constraints |
| Verification tests | Passing | Includes exact-token validation, pinned public address, redirects, private/mixed DNS results, response ceiling, and timeout handling |
| Quota tests | Passing | Trial asset and verification limits covered by unit tests; database triggers also enforce asset and verification ceilings |
| Asset component tests | Passing | Registration form accessibility and safety copy covered |
| Workspace role tests | Passing | Owner/admin/member accepted, viewer denied for asset management |
| Supabase security advisor | Passing | No security lints after Phase 2 hardening |
| Supabase performance advisor | Passing with informational notices | Composite FK coverage fixed; remaining notices are unused-index INFO expected before traffic. See https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index |
| Cross-workspace RLS isolation | Passing | Test user saw only its own workspace asset; cross-workspace access stayed hidden |
| Direct authenticated Phase 2 writes | Passing | Direct asset INSERT/UPDATE/DELETE and direct verification-challenge INSERT were denied |
| Phase 2 active scanning | Disabled by design | Scan-job schema cannot queue active work in Phase 2 |

## Security regression coverage added during final review

- IPv4-mapped IPv6 local-address rejection
- special-use address rejection
- DNS result validation before network access
- IP-pinned HTTPS connection to prevent DNS-rebinding/TOCTOU between validation and request
- manual redirect handling
- trusted-write-only Phase 2 mutation boundary
- immutable verified asset identity fields
- one active verification challenge per asset
- composite `(asset_id, workspace_id)` integrity constraints
- database-enforced concurrent asset and verification quotas

## Release rule

PR #4 must not merge until its final head passes unit tests, typecheck, and production build. Supabase security lints must remain empty. Unused-index INFO notices are acceptable until realistic traffic provides index-usage evidence.
