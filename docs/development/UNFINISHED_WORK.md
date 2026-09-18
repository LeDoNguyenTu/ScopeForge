# ScopeForge Unfinished Work

Last reconciled: 2026-09-19, Asia/Singapore.

## Active

Finish PR #143, the Phase 11C HTTP worker-control source slice.

Remaining release work:

- exact-head full GitHub CI
- fix any test/typecheck/build/security regression
- final review-thread and mergeability check
- merge source-only if all gates pass
- verify merged `main` CI and production Vercel health

## Next implementation gate

After PR #143:

1. build/pin the exact runtime image candidate for the released source
2. run real Linux rootless-Podman and cgroup-v2 acceptance for `phase11_http_discovery_v1`
3. prove target-only mediator authority, container `--network=none`, cancellation, process cleanup, PID/CPU/memory/scratch/output ceilings, no control-socket escape, and secret-safe logs
4. record the exact image digest and acceptance evidence
5. only then design a separately reviewed hosted enablement release

## Separately gated

- Do not apply Phase 11A or Phase 11C migrations to production yet.
- Do not allow the standard worker runtime configuration to select `phase11_http_discovery_v1` before Linux acceptance.
- Do not enable external Nmap, Nuclei, or httpx process execution.
- Do not weaken Phase 11 authorization, worker authentication, RLS, service-role-only RPC boundaries, or runtime containment.
- Keep ScopeForge Supabase `tdgpibrepzcvdivztkta` separate from Job Command Center `xwsergbpvkcsugexssmc`.

## Completed; do not repeat

- Phase 11 Tasks 1 through 9.
- Task 11 deterministic evaluation slices, including graph expansion and approval fixtures.
- Phase 11C provider dependency/threat-model review.
- Hardened provider contracts released through PR #141.
- Bounded HTTP discovery mediator/runtime foundation released through PR #142.
- Vercel Hobby deployment-budget filtering.
