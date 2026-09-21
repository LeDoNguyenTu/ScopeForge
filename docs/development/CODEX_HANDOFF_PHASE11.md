# Codex Handoff - Phase 11 Closure

Last reconciled: 2026-09-21, Asia/Singapore.

This is the canonical resume document for another agent/Codex. Read it before changing anything.

## Objective

Finish the remaining **operational** Phase 11 gate without widening authority.

Working estimate at handoff:

- Phase 11 source: ~100%
- Phase 11 operational acceptance: ~94%
- overall "finish Phase 11" task: ~98%
- whole ScopeForge project: ~90%

These are project-management estimates, not computed coverage metrics. Update them only when release gates materially change.

## Latest operational reconciliation

Current released main is `7a489da09a65bdd8f33c15ca47b86464796546b2`, merge of PR #165. PR #165 is documentation-only reconciliation on top of the PR #164 runtime fix.

Release evidence:

- PR #163 released the Unix-socket pathname-length fix at `/run/scopeforge-worker/mediator`.
- PR #164 fixed the trusted preparation state machine so a correctly claimed Phase 11 action in `running` state is accepted.
- PR #164 exact-head CI run `35542030195` completed successfully across the full test suite, typecheck, CLI/worker builds, scanner and Phase 11 benchmarks, Next build, CSP/Phase 11 browser smoke, production diagnostic, and screenshot upload.
- Vercel production deployment `dpl_BfJTTEGbsetMMMNF2jCF1w6woVDj` is READY on exact SHA `7a489da09a65bdd8f33c15ca47b86464796546b2`. The prior PR #164 runtime deployment `dpl_8AYvooHJ38pJEk5yPfEe7o2JdiWe` is also READY.
- The dedicated Phase 11 worker has authenticated against that exact deployment and returned repeated idle claim HTTP 200 responses.
- Live reconciliation on 2026-09-21 confirmed the Phase 11 queue still has no queued or leased work. Three failed canaries remain preserved as `dead_letter` evidence. The worker remains enabled and its latest lease heartbeat is `2026-09-20 21:49:13.335068+00`.
- Direct live privilege inspection found zero `anon` or `authenticated` grants on the nine Supabase private worker tables flagged for RLS-disabled advisory. Do not auto-enable RLS without a tested service-role policy design.

Do not lower the remaining operational gate merely because PR #164 is released. One authenticated end-to-end canary is still required.

## 2026-09-21 findings UI release

Live reconciliation before this slice:

- `origin/main` was `0b96b76c74a0f74a35cc4ed8fbb33491b8a1ac0b`
- no open pull requests or issues
- latest completed main CI was run `35535126964`, green on source SHA `94a6a93e78236eaff04cb806ad7092638f4e4065`
- local branch: `fix/findings-human-readable-ui-20260921`

The branch improves the findings list/detail presentation without changing canonical finding rows, lifecycle authorization, remediation authorization, RLS, or worker behavior:

- raw hosted scanner IDs are replaced in primary copy with human-readable analysis-source names
- canonical rule/source identifiers remain available in a collapsed technical-identifiers section
- the security story is grouped into what happened, recommended fix, and how to verify
- owner/admin remediation assignment uses the existing authorized collaborator roster instead of accepting a raw user UUID
- member self-assignment and viewer read-only behavior remain unchanged
- detail rows, evidence/history rows, severity treatment, form spacing, wrapping, contrast, and mobile layout are tightened

TDD evidence and local validation:

- RED: the new presentation module was missing and the existing remediation form exposed `Assignee user ID`
- focused findings tests: 7 passed
- focused findings plus prior full-suite timeout cases: 11 passed
- typecheck passed
- CLI build passed
- worker build passed after restoring lockfile dev dependencies with `npm ci --include=dev`
- Next production build passed
- `npm audit --audit-level=high`: zero vulnerabilities
- full suite reached 2,267 passed / 26 skipped; two Windows timing-bound tests failed only by timeout and both passed when rerun in isolation

PR #162 merged as `a04d90d10cd073161b59bb6d9b6466b58c3e5923`. Exact-head CI run `35537866841` and post-merge main CI run `35538297419` passed. Production deployment `dpl_9WuwE3sxs4gbc9BqY2doxHBuZuUQ` is READY and serves `scopeforge.dev`.

The connected Chrome extension later exposed the authenticated platform-admin session and the Phase 11 admin control rendered correctly. Continue to use the Chrome extension for authenticated visual checks; do not use whole-desktop automation.

This UI slice is independent of the remaining Phase 11 production-worker canary below. Do not treat it as Phase 11 operational acceptance.

## Start here

1. Resolve current `main` first. The Phase 11 source baseline is `81282bf786b3b7f82b2f9ebb8427117c2a51912a` (PR #160); PR #161 and any later commits may be documentation/closure follow-through.
2. Check open PRs/CI/deployments before assuming this SHA is still current.
3. Read:
   - `docs/development/CURRENT_STATE.md`
   - `docs/development/UNFINISHED_WORK.md`
   - `docs/development/PHASE11C_PRODUCTION_ENABLEMENT.md`
   - `docs/validation/phase-11/COMPLETION_MATRIX.md`
   - `docs/validation/phase-11/ADVANCED_PROVIDER_DECISIONS.md`
4. Live provider state wins over documentation if anything changed after this handoff.

## Completed - do not redo

Phase 11 Tasks 1-16 are complete for the initial approved source scope.

PR #160 exact-head CI run `35534658243` is green. It passed:

- full repository tests
- typecheck
- CLI build/version
- worker build
- scanner benchmark
- scanner matrix benchmark
- adaptive Phase 11 benchmark
- Phase 11 matrix benchmark
- labeled Phase 11 benchmark
- real loopback legal-lab benchmark
- Next.js build
- CSP/browser acceptance
- production UI diagnostic

Do not re-open feature implementation merely to increase provider count.

## Production systems

ScopeForge Supabase:

`tdgpibrepzcvdivztkta`

Do not confuse it with Job Command Center.

Phase 11 worker:

- ID `cd9a7769-e21f-4f75-84c3-ffe2d1f4616e`
- class `phase11_http_discovery_v1`
- registered software version `ec3cdb2cf117c81c126973c2fcefb02e38fb4d14`
- existing credential remains only on the dedicated host
- do not rotate or recreate this identity unless required by an explicit credential-rotation procedure

Accepted runtime image:

`localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`

The image remains unchanged for the closure canary.

## First canary - preserve as failed evidence

Do not delete or rewrite these rows.

- run `bbd5c0cd-717c-4ee3-a5a6-c1028331f5b4`
- authorization snapshot `phase11-auth:bbd5c0cd-717c-4ee3-a5a6-c1028331f5b4`
- action `phase11-action:bb4b6588033f981264bab07a8584df3d5fea86696db79a8f90f2177ac508f9a9`
- task `aa6f13c2-6512-498f-95a7-ea7f7cce4e7e`
- attempt `52c4c9fd-7a46-4c56-b3fd-63f843162b70`
- capability `web.http.probe.v1`
- provider `scopeforge.http-discovery` v1.0.0
- one request charged
- action terminal
- attempt `provider_failed`
- error `WORKER_EXECUTION_FAILED`
- no observation produced
- run terminal failed with `request_budget_exhausted`
- worker `last_seen_at` advanced to `2026-09-20 15:39:15.766929+00`

Interpretation: planner/policy/authorization/queue/worker lease/finalization/accounting paths worked. Sandbox/provider execution did not.

## Second canary - preserve as failed evidence

The PR #159 bundle was deployed to the Oracle host, but the follow-up canary also failed before sandbox execution:

- run `dd90af93-9f9e-4168-8a2a-067302210f85`
- action `phase11-action:dfe0443e9f0f41f1012054da78ad4e2cc466242013b4fb0344c41bd09f774c8b`
- task `f59e0413-27ef-43b2-bf32-d11d3d54a77e`
- attempt `913086b3-52f1-4405-b613-025830cb2d38`
- exactly one request charged
- attempt `provider_failed`, error `WORKER_EXECUTION_FAILED`
- worker metrics all zero and no observation/evidence produced
- run terminal failed with `request_budget_exhausted`
- no container or mediator socket remained

Do not retry this run or remove its evidence.

## Third canary - preserve as failed evidence

The PR #163 worker bundle with the corrected socket pathname was deployed, but the next bounded canary still failed before sandbox execution:

- run `3a96f604-857c-4a36-8d23-3c2127ab08de`
- action `phase11-action:fef9fd799e90c749af29156b0376b312187ed43c0cc0b016e352408b88f6dd05`
- task `36c86535-d7b9-4c11-bb16-c2ce03c74f3d`
- attempt `37469474-2a71-4b6d-9cf8-176b01fa19d8`
- exactly one request charged
- task `dead_letter`
- attempt `failed` with `WORKER_EXECUTION_FAILED`
- all worker metrics zero
- no observation produced
- attempt duration about 313 ms

Vercel production logs for the exact attempt showed:

- `POST /api/internal/workers/phase11-http/prepare` -> HTTP 409
- no heartbeat
- `POST /api/internal/workers/phase11-http/finalize` -> HTTP 200

The root cause was a trusted state-machine contradiction, not a sandbox failure. The claim RPC intentionally moves the action to `running`, while preparation accepted only `enqueueing` or `queued`. PR #164 adds `running` as the valid post-claim state and makes the regression fixture default to that real leased state.

Do not retry or delete this failed canary.

## Corrected root causes and released fixes

The hardened service remains unchanged:

- `ProtectSystem=strict`
- `RuntimeDirectory=scopeforge-worker`
- writable runtime path `/run/scopeforge-worker`
- immutable accepted runtime image
- rootless Podman with `--network=none`
- closed mediator and authorization boundaries

Operational defects found and released:

1. PR #159 moved the mediator host socket into the systemd-owned runtime directory.
2. PR #163 shortened the host socket pathname from the 109-byte failing form to the 101-byte `/run/scopeforge-worker/mediator/<64-hex>.sock` form without reducing nonce entropy or widening containment.
3. PR #164 corrected the post-claim action-state validator to accept the authoritative `running` state after a valid lease.

Live Supabase definitions confirm preparation remains bound to the authenticated worker class, leased task, unfinished attempt, and valid lease hash. PR #164 does not create a pre-claim execution path.

## Exact remaining execution sequence

### 1. Reconcile release state

Before the final canary, reconfirm:

- main is at least `3cc1443ed292a14fe6738bc64a0b8629b5992d56`
- Vercel production for the intended main is READY
- no unexpected queued or leased Phase 11 task exists
- existing worker identity remains enabled
- authenticated idle claim still succeeds

Do not redeploy or rotate the worker merely because PR #164 changed server-side preparation logic.

### 2. Run exactly one new canary

Use the authenticated platform-admin `/admin/phase11` control and an existing verified ScopeForge-owned HTTPS web/API asset.

The canary must remain:

- `web.http.probe.v1`
- root-only GET
- redirects disabled
- exactly one request ceiling
- 5-second action runtime ceiling
- no intrusive/validation capability
- no external Nmap/Nuclei/httpx
- no third-party target

Do not manually insert a worker task or call service-role SQL to manufacture acceptance.

### 3. Acceptance criteria

Require all of:

- worker leases the new task
- prepare succeeds past the previous HTTP 409 boundary
- mediator/sandbox execution starts normally
- exactly one request is charged
- attempt reaches a valid terminal result
- run/action/task reconcile terminally
- either a valid observation is persisted or the provider produces a legitimate no-signal result
- coverage request-count delta is exactly one
- no duplicate terminal accounting
- no out-of-scope redirect/target authority
- no response body, credential, auth token, or secret leakage in ordinary logs/evidence
- no remaining runtime container
- no remaining mediator socket
- cancellation/recovery semantics remain intact

Do not manufacture a finding.

### 4. Host verification

Use the accepted Oracle Linux host to confirm no leftover Phase 11 runtime container or mediator socket after the final canary. Preserve the existing worker credential and immutable runtime image. Do not weaken systemd, Podman, cgroup, or egress controls.

### 5. Close Phase 11

After acceptance:

1. record exact successful run/action/task/attempt/observation IDs and coverage evidence in the Phase 11 validation docs
2. update `CURRENT_STATE.md`, `UNFINISHED_WORK.md`, and completion matrix
3. remove temporary `public/.well-known/scopeforge-verification.txt`
4. run focused/full CI as appropriate
5. merge the closure PR
6. verify exact-main Vercel production
7. mark Phase 11 operationally 100%

## Explicit non-goals

Do not:

- reapply deployed migrations
- create a new worker identity without need
- enable external Nmap/Nuclei/httpx
- integrate broad exploit frameworks
- widen target discovery
- use third-party assets
- bypass admin authorization
- weaken containment to make the canary pass
- delete failed canary audit evidence

## Cleanup note

PR #152 is obsolete/superseded by #153 and #160. It should be closed and must not be used as a resume point.
