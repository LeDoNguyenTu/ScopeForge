# ScopeForge Codex handoff

Last reconciled: 2026-09-20, Asia/Singapore. Live GitHub/provider state wins.

## Resume point

- Released `main`: `d92698ae118fb5aa0af7d9db6589348b89576d2e`, merge of PR #150; exact-main CI `35460959197` passed.
- PR #147 exact-head CI run `35409821247` passed.
- Vercel production deployment `dpl_49mavQuJxwksw1AcaZzmZfaAdvSA` is READY and contains `/admin/phase11`.
- PR #143 released trusted Phase 11C HTTP worker control.
- PR #144 released reproducible runtime-image source plus the worker-bundle CI gate.
- PR #145 released result-to-coverage reconciliation.
- PR #146 released the exact-image Linux containment acceptance record.
- PR #147 released explicit default-off worker-host selection of `phase11_http_discovery_v1` using an immutable runtime-image digest.
- Exact-image Linux containment acceptance passed for `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`.
- Production Supabase project `tdgpibrepzcvdivztkta` is ACTIVE_HEALTHY on PostgreSQL 17.
- Live migration history now includes Phase 11A planning/orchestration, Phase 11C HTTP worker control, and Phase 11C result coverage reconciliation. Do not reapply them.
- A dedicated `phase11_http_discovery_v1` worker identity is already registered for software version `ec3cdb2cf117c81c126973c2fcefb02e38fb4d14`.
- The worker is deployed as `scopeforge-worker@phase11-http`; authenticated empty claims and class-scoped stop/start rollback passed without changing the existing snapshot/scan workers.
- Idle claims intentionally do not update `last_seen_at`; it advances only for leased task heartbeats.
- PR #150 released the planner-owned closed HTTP parameters and platform-admin verified-asset canary control at `/admin/phase11`.
- Active branch `ops/phase11-production-canary-evidence-20260920` closes the post-terminal lifecycle gap: Phase 11 HTTP finalization advances the parent run after both a fresh terminal write and an exact replay.

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

It is already represented in the live production migration history.

## Immediate work

1. release the retry-safe post-finalization run advancement slice after exact-candidate CI
2. run exactly one verified-asset canary from `/admin/phase11`
3. verify terminal run/task/action state, request accounting, result-to-coverage reconciliation, logs, and host cleanup
4. record exact evidence and close the operational runbook
5. keep external Nmap, Nuclei, and external httpx process execution disabled until their separately reviewed gates are complete

## Hard boundaries

- ScopeForge Supabase is `tdgpibrepzcvdivztkta`.
- Do not reapply any Phase 11 migration already present in the live migration history.
- Use only the accepted immutable Phase 11 HTTP image digest in any enablement release.
- Preserve `--network=none`, immutable OCI digest use, and host-mediator-only network authority.
- No browser/user-controlled URL, method, headers, body, argv, network policy, worker budget, or direct target authority.
- Phase 11 worker-control RPCs are service-role only in production.
- No external Nmap/Nuclei/httpx process runner is enabled.
- No AI co-author metadata.

## Production security note

Supabase Security Advisor flags several private worker tables because RLS is disabled. Do not blindly enable RLS: the current private schema has no direct `anon` table privileges for the checked worker tables, and the checked Phase 11 worker RPCs are explicitly executable only by `service_role`. Any RLS change must be designed and tested as a separate migration so existing worker service paths are not silently broken.

The two public workspace collaborator `SECURITY DEFINER` RPC warnings were reviewed in source. They intentionally grant execute to `authenticated`, but both derive the actor from `auth.uid()`, verify the account is live, and require owner/admin workspace authority before accessing collaborator data or mutating membership.

## Acceptance evidence

See `docs/development/PHASE11C_LINUX_ACCEPTANCE.md`. The accepted host run proved real mediator-only HTTPS, real cross-host redirect rejection, direct-egress denial, fixed cgroup/resource controls, cancellation and wall-time/output cleanup, and a clean terminal state.

## Release-candidate validation history

CI #1199 ran against an earlier PR #145 head and reached the full test suite. It reported two release-candidate issues:

- the new migration had not yet restated explicit revokes for the two replaced private recovery functions and the graph-persistence RPC, which violated the permanent Phase 9C future-function ACL guard
- the new PGlite prerequisite fixture had malformed dollar-quoted stub bodies caused by generation-time string replacement

The corrected candidate fixed both, subsequent exact-head/post-merge validation passed, and PR #147 later passed exact-head CI run `35409821247` before merge.
