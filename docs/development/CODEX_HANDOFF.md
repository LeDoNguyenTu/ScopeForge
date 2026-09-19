# ScopeForge Codex handoff

Last reconciled: 2026-09-19, Asia/Singapore. Live GitHub/provider state wins.

## Resume point

- Released `main`: `4f388834cec38aef335f4dbf5657101171416c9e` from PR #145.
- PR #143 released trusted Phase 11C HTTP worker control.
- PR #144 released reproducible runtime-image source plus the worker-bundle CI gate.
- PR #145 released result-to-coverage reconciliation and passed post-merge CI `35406951340`.
- Exact-image Linux containment acceptance passed for `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`.
- Active branch: `docs/phase-11c-linux-acceptance-20260919` records that evidence.

## Released reconciliation slice

PR #145 closed the production orchestration accounting gap:

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

1. release the acceptance documentation after exact-head CI
2. create a separate source slice that permits normal worker configuration for the Phase 11 HTTP class while keeping it absent/default-off in production
3. use only the accepted immutable image digest
4. prove authenticated idle worker operation and a class-scoped rollback
5. re-read the production migration ledger, then apply only the reviewed absent Phase 11 migrations as a separate release action
6. run one bounded authorized production acceptance before leaving the class enabled

## Hard boundaries

- ScopeForge Supabase is `tdgpibrepzcvdivztkta`.
- Production migration ledger still ends at Phase 10A3 until a separately approved migration gate.
- Source merge does not authorize Phase 11 migration application.
- Use only the accepted immutable Phase 11 HTTP image digest in any enablement release.
- Preserve `--network=none`, immutable OCI digest use, and host-mediator-only network authority.
- No browser/user-controlled URL, method, headers, body, argv, network policy, worker budget, or direct target authority.
- No external Nmap/Nuclei/httpx process runner is enabled.
- No AI co-author metadata.

## Acceptance evidence

See `docs/development/PHASE11C_LINUX_ACCEPTANCE.md`. The accepted host run proved real mediator-only HTTPS, real cross-host redirect rejection, direct-egress denial, fixed cgroup/resource controls, cancellation and wall-time/output cleanup, and a clean terminal state. Production Supabase remained `tdgpibrepzcvdivztkta` and its live migration ledger still ended at Phase 10A3.


## Release-candidate validation history

CI #1199 ran against an earlier PR #145 head and reached the full test suite. It reported two release-candidate issues:

- the new migration had not yet restated explicit revokes for the two replaced private recovery functions and the graph-persistence RPC, which violated the permanent Phase 9C future-function ACL guard
- the new PGlite prerequisite fixture had malformed dollar-quoted stub bodies caused by generation-time string replacement

The current head fixes both:
- every created/replaced public or private function in the migration has an explicit same-migration revoke, with only the reviewed service-role grants restored where required
- the PGlite stubs use literal balanced `$$...$$` bodies and the migration itself has one balanced body per intended function

CI #1199 otherwise reported 484 passing test files and 2,254 passing tests before those two failures. The corrected exact head and post-merge `main` subsequently passed.
