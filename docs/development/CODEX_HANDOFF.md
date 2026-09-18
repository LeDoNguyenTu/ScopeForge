# ScopeForge Codex handoff

Last reconciled: 2026-09-19, Asia/Singapore. Live GitHub/provider state wins.

## Resume point

- Released `main`: `83855118b36fb7c65f7a5882bcd8abfef7ac5ec1` from PR #144.
- PR #143 released trusted Phase 11C HTTP worker control.
- PR #144 released reproducible runtime-image source plus the worker-bundle CI gate.
- Active branch: `feat/phase-11c-result-coverage-reconciliation-20260919`.
- Re-resolve the live branch/PR head before changing anything.

## Active slice

The current branch closes the production orchestration accounting gap:

- immutable whole-run request/graph-expansion/provider-failure ceilings
- `advancePentestRun()` evaluates deterministic stop conditions before planning
- private action attempts persist request usage
- HTTP finalization atomically reconciles action results into coverage
- expired leased HTTP attempts charge a conservative bounded request count
- unclaimed tasks charge zero
- blocked/cancelled/policy-rejected actions do not falsely claim coverage
- stale graph persistence merges committed coverage monotonically instead of rolling counters backward
- HTTP request accounting is capped to the execution-class ceiling of 12
- terminal replay remains idempotent and does not double-charge coverage

The forward-only migration is:
`supabase/migrations/20260919020000_phase_11c_result_coverage_reconciliation.sql`

## Immediate work

1. inspect the live active-branch head
2. run focused and then exact-head validation
3. fix any regression using tests first
4. create/review the PR if not already open
5. merge only when the exact candidate is green, mergeable, and has no unresolved review threads
6. verify the exact merged production Vercel deployment
7. verify production Supabase still has no Phase 11/11C migration applied
8. then move to the real Linux Phase 11 HTTP containment gate

## Hard boundaries

- ScopeForge Supabase is `tdgpibrepzcvdivztkta`.
- Production migration ledger still ends at Phase 10A3 until a separately approved migration gate.
- Source merge does not authorize Phase 11 migration application.
- Do not enable `phase11_http_discovery_v1` in normal hosted worker configuration before exact-image Linux acceptance.
- Preserve `--network=none`, immutable OCI digest use, and host-mediator-only network authority.
- No browser/user-controlled URL, method, headers, body, argv, network policy, worker budget, or direct target authority.
- No external Nmap/Nuclei/httpx process runner is enabled.
- No AI co-author metadata.
