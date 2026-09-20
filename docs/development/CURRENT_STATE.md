# ScopeForge Current State

Last reconciled: 2026-09-21, Asia/Singapore. Live provider state wins.

## Released baseline

- Phase 11 source baseline: `81282bf786b3b7f82b2f9ebb8427117c2a51912a` after PR #160. PR #161 then reconciled handoff/status documentation only. Always resolve live `main` before starting work.
- PR #155 released bounded Phase 11E web/API discovery.
- PR #156 released Phase 11F session/browser authority.
- PR #157 released Phase 11G proof-only validation.
- PR #158 released continuous-validation/remediation feedback.
- PR #159 released the Phase 11 mediator runtime-directory fix.
- PR #160 released the final Phase 11 source-validation gates and Task 16 capability-gap decisions.
- PR #160 exact-head CI run `35534658243` passed every required step, including the four Phase 11 benchmark runners and browser acceptance.
- Last independently verified Vercel production deployment before PR #160 merge was `dpl_28CYfNwZ6xAzEfgvKM8wTpo1cf7C`, READY on main SHA `5fbc5bc9e655fa88531b62e51e452fceb33775c5` (PR #159). Recheck the exact PR #160 production deployment before the next canary.

## Phase 11 source status

Tasks 1 through 16 are complete for the initial Phase 11 release scope.

- graph, hypotheses, policy, provider contracts/registry, native observations, planner, persistence, and run orchestration are released
- bounded first-party HTTP execution is implemented with dedicated worker containment
- Task 11 adaptive/legal-lab evaluation is a permanent CI gate
- web/API discovery, session/browser authority, proof-only validation, and continuous validation are released in source
- Task 16 advanced-provider evaluation is complete; Prowler, Kubescape, CodeQL execution, TruffleHog, MobSF, Amass/BBOT, and specialist reverse-engineering providers remain deferred until a measured capability gap justifies their authority/cost
- external Nmap, Nuclei, and external httpx process execution remain separately gated and disabled

See `docs/validation/phase-11/COMPLETION_MATRIX.md`.

## Production database state

ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Do not confuse it with the Job Command Center Supabase project.

Reviewed Phase 11A/11C migrations are already present in production. Do not reapply them.

The registered Phase 11 HTTP worker remains:

- worker ID: `cd9a7769-e21f-4f75-84c3-ffe2d1f4616e`
- execution class: `phase11_http_discovery_v1`
- registered software version: `ec3cdb2cf117c81c126973c2fcefb02e38fb4d14`
- last observed lease heartbeat: `2026-09-20 15:39:15.766929+00`
- disabled: no

Do not rotate/re-register the worker merely because the bundle changed. Preserve the existing host-stored credential unless an explicit credential-rotation procedure is required.

## First production canary evidence

One bounded production canary was run through the normal admin/planner/policy/authorization/queue path.

- run ID: `bbd5c0cd-717c-4ee3-a5a6-c1028331f5b4`
- run status: `failed`
- stop reason: `request_budget_exhausted`
- authorization snapshot: `phase11-auth:bbd5c0cd-717c-4ee3-a5a6-c1028331f5b4`
- action ID: `phase11-action:bb4b6588033f981264bab07a8584df3d5fea86696db79a8f90f2177ac508f9a9`
- capability: `web.http.probe.v1`
- action decision: approved
- action state: terminal
- max requests: 1
- max runtime: 5000 ms
- worker task ID: `aa6f13c2-6512-498f-95a7-ea7f7cce4e7e`
- attempt ID: `52c4c9fd-7a46-4c56-b3fd-63f843162b70`
- provider: `scopeforge.http-discovery` v1.0.0
- attempt status: `provider_failed`
- request_count: 1
- error: `WORKER_EXECUTION_FAILED`
- observations: 0

This proves the control path reached the dedicated worker and request accounting/finalization worked. It is not a successful operational acceptance.

## Canary failure root cause and released fix

The dedicated worker is hardened with `ProtectSystem=strict` and `RuntimeDirectory=scopeforge-worker`, making `/run/scopeforge-worker` the declared writable runtime path.

The supervisor previously attempted to create its host mediator socket under:

`/run/scopeforge/runtime-mediator`

That path is outside the service writable set. PR #159 changed only the host mediator root to:

`/run/scopeforge-worker/runtime-mediator`

The in-container mediator path remains `/run/scopeforge/mediator.sock`. Podman network isolation, sandbox limits, authorization, and target scope were not widened.

The PR #159 application deployment is verified READY. The corrected worker bundle still has to be built/deployed to the dedicated Oracle Linux worker host before the canary can be rerun.

## Immutable runtime boundary

Accepted runtime image remains:

`localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`

Do not replace it with a mutable tag or enable additional execution classes to close Phase 11.

## Remaining Phase 11 operational gate

1. Recheck post-merge CI and Vercel production for exact main `81282bf786b3b7f82b2f9ebb8427117c2a51912a`.
2. On the accepted Oracle Linux host, build/deploy the current `scopeforge-worker.cjs` using Node 24 and the released source.
3. Preserve the existing Phase 11 worker identity/credential and immutable runtime image.
4. Restart only `scopeforge-worker@phase11-http`.
5. Prove idle authentication and no leftover container/socket.
6. Run exactly one new verified-asset root-only canary from `/admin/phase11`.
7. Require exactly one request, terminal run/action/task state, a valid observation or legitimate no-signal result, coverage reconciliation, zero secret/response-body leakage, and no remaining container/socket.
8. Record the successful evidence in Phase 11 validation/status docs.
9. Remove `public/.well-known/scopeforge-verification.txt` after verification/canary closure.
10. Only then mark Phase 11 operationally 100% complete.

Canonical handoff: `docs/development/CODEX_HANDOFF_PHASE11.md`.
