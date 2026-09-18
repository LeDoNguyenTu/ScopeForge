# ScopeForge Codex handoff

Last reconciled: 2026-09-19, Asia/Singapore. Live GitHub/provider state wins.

## Resume point

- Released `main`: `30b45974126797509eb66dd12f26528970a7bdee` from PR #142.
- Active PR: #143 - trusted Phase 11C HTTP worker control.
- Active branch: `feat/phase-11c-http-worker-control-20260919`.
- Re-resolve the live PR head before making changes.

PR #143 has advanced through the complete source control path:

- service-role-only immutable Phase 11 worker binding and queue
- dedicated register/claim RPCs
- authenticated lease-bound preparation/finalization routes
- authoritative scope/expiry/capability checks
- cancellation and replay-safe terminal handling
- provider normalization plus atomic Phase 11 observation/action-attempt persistence
- generic claim and terminal parsing for `phase11_http_discovery_v1`
- explicit supervisor prepare/finalize and executor routing
- networkless container execution through the existing single-use Unix mediator

The Phase 11-specific closed validators remain authoritative.

## Immediate work

1. inspect the live #143 head and its newest CI
2. preserve the request-accounting hardening: non-success HTTP attempts must never be finalized as zero requests merely because exact mediator accounting is unavailable
3. fix any failures using TDD
4. run full exact-head CI
4. verify no review threads and that the PR remains mergeable
5. merge only when the exact candidate is green
6. verify post-merge main CI and Vercel production
7. then move to real Linux containment acceptance

## Hard boundaries

- ScopeForge Supabase is `tdgpibrepzcvdivztkta`.
- Production migration ledger still ends at Phase 10A3.
- Do not apply Phase 11/11C migrations just because source merges.
- Do not enable `phase11_http_discovery_v1` in the normal hosted worker runtime before Linux acceptance.
- No external Nmap/Nuclei/httpx process runner is enabled.
- Preserve `--network=none` in the executor and host-mediator-only network authority.
- No browser/user-controlled URL, method, headers, body, argv, network policy, worker budget, or direct target authority.
- No AI co-author metadata.


## Latest release review

CI #1193 passed the complete test suite but failed typecheck on two implicit queue-repository input parameters; those inputs are now explicitly typed.

A subsequent security review found a request-budget accounting gap for failed/cancelled HTTP attempts. The fix preserves exact counts when available and otherwise charges the authorized `maxRequests` conservatively. The SQL finalizer no longer resets non-success request counts to zero.

Do not merge PR #143 without a fresh exact-head CI after these fixes.
