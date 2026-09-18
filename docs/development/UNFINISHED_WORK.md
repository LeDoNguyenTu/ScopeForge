# ScopeForge Unfinished Work

Last reconciled: 2026-09-19, Asia/Singapore.

## Active

Finish the Phase 11C result-to-coverage reconciliation branch:

`feat/phase-11c-result-coverage-reconciliation-20260919`

Release gates:

- focused/domain/migration regression tests
- exact-head full GitHub CI
- typecheck, worker bundle, benchmarks, application build, CSP/browser diagnostics
- final review-thread and mergeability check
- source-only merge if all gates pass
- production Vercel health check after merge
- confirm Phase 11/11C migrations remain unapplied

## Next external gate

After the source reconciliation slice is released:

1. use an exact clean `main` checkout on the dedicated Linux worker host
2. build `.scopeforge-worker-build/runtime-worker-entry.js`
3. build `deploy/worker/Containerfile.runtime` with rootless Podman and `--network=none`
4. record the immutable `localhost/scopeforge-runtime-worker@sha256:<digest>` candidate
5. run the affected Phase 11 HTTP containment acceptance
6. prove target-only mediator authority, direct-egress denial, redirect reauthorization, cancellation/process cleanup, PID/CPU/memory/scratch/output ceilings, socket isolation, and secret-safe logs
7. keep hosted runtime configuration disabled unless that exact candidate passes

## Separately gated

- Do not apply Phase 11A or Phase 11C migrations to production yet.
- Do not allow the standard worker runtime configuration to select `phase11_http_discovery_v1` before Linux acceptance.
- Do not enable external Nmap, Nuclei, or httpx process execution.
- Do not weaken Phase 11 authorization, worker authentication, RLS, service-role-only RPC boundaries, or runtime containment.
- Keep ScopeForge Supabase `tdgpibrepzcvdivztkta` separate from Job Command Center `xwsergbpvkcsugexssmc`.

## Completed - do not repeat

- Phase 11 Tasks 1 through 9.
- Task 11 deterministic evaluation slices released to date.
- Phase 11C provider dependency/threat-model review.
- PR #141 provider contracts.
- PR #142 bounded HTTP mediator/runtime foundation.
- PR #143 trusted HTTP worker control.
- PR #144 reproducible runtime-image candidate source/build gate.
- Vercel Hobby deployment-budget filtering.
