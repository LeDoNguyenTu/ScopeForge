# ScopeForge Current State

Last reconciled: 2026-09-22, Asia/Singapore. Live provider state wins.

## 2026-09-22 final-canary attempt and confirmed orchestration defect

Exactly one authenticated production canary was queued in the 2026-09-22 single-Codex run. Do not create another canary in that run.

- run: `2409c669-306b-4a7f-bf83-e3bcf1efc0cc`
- action: `phase11-action:0d3b8a92c08aed7f9b351991eb7291c2c5ad6e007bcd7f5f376d0793542da9b4`
- task: `d15b183e-d1cd-4f52-a617-64ec2260d309`
- worker/action attempt: `f81f2f16-30de-41cf-a5ab-ee641e2e7804`
- observation: `phase11-obs-http:51f1b31271876b0eee32170ac86a44bf23a19bb4a321fac568d596dafe7b443e`
- worker outcome and action-attempt status: `succeeded`
- task/action: terminal and completed as expected
- coverage: one request, zero provider failures, zero graph expansion
- parent run: `failed` with `request_budget_exhausted`
- authoritative evidence verdict: `acceptance_ready = false` only because `run_completed = false`; every other mechanical acceptance check passed

Vercel production logs on exact deployment `dpl_C84oG7p5n66awbiR84ZMp49RwuNd` show prepare HTTP 200 and finalize HTTP 200, with no runtime-error cluster in the canary window. Oracle verification ended with `PHASE11_HOST_CLEANUP_PASS`: the service remained active, the accepted immutable image was present, and no exact canary container or mediator socket remained.

The confirmed root cause is the interaction between two released semantics: `evaluateStopConditions` selected `request_budget_exhausted` before `provider_failure_limit`, and `stop_phase11_pentest_run` classified every request-budget stop as `failed`. The scoped fix makes provider failure win when both ceilings are reached and maps clean request-budget exhaustion to `completed` in a forward-only migration. The terminal canary row must not be rewritten; after the fix is released, a new authenticated canary requires a separately authorized later run.

The temporary verification proof remains present because Phase 11 acceptance did not complete.

## Released baseline

- Latest runtime-changing Phase 11 baseline: `3cc1443ed292a14fe6738bc64a0b8629b5992d56`, merge of PR #164. Later docs-only reconciliation commits may move `main`; resolve live `main` before acting.
- PR #163 released the Unix-socket pathname-length fix, moving the private host socket root to `/run/scopeforge-worker/mediator`.
- PR #164 released the Phase 11 post-claim preparation state fix. Exact-head CI run `35542030195` passed the full suite, typecheck, CLI/worker builds, scanner and Phase 11 benchmarks, Next production build, CSP/Phase 11 browser smoke, production diagnostic, and artifact upload.
- Vercel production deployment `dpl_8AYvooHJ38pJEk5yPfEe7o2JdiWe` is READY on exact runtime SHA `3cc1443ed292a14fe6738bc64a0b8629b5992d56`. Later docs-only production deployments may be newer while preserving the same Phase 11 runtime behavior.
- The dedicated Phase 11 worker authenticated against that exact deployment with repeated idle `POST /api/internal/workers/claim` HTTP 200 responses.
- PR #162 released the human-readable findings UI.
- Phase 11 source baseline remains complete through PR #160. PRs #163 and #164 are operational closure fixes, not scope expansion.

## 2026-09-21 database performance hardening

PR #168 merged additive foreign-key index hardening after exact-head CI run `35584817649` passed the full repository gate. Production migration `cross_phase_fk_index_hardening` was then applied to ScopeForge Supabase `tdgpibrepzcvdivztkta`.

Post-migration Supabase performance advisor reconciliation reports zero `unindexed_foreign_keys` findings, down from 16 before the migration. The remaining `unused_index` notices are informational and expected immediately after new indexes are created; do not drop indexes solely from that fresh counter state.

The migration changes indexes only. It does not modify RLS, grants, functions, constraints, worker authority, or Phase 11 execution behavior.

Production security-advisor decisions are recorded in `docs/security/PRODUCTION_SUPABASE_ADVISORS.md`.

## 2026-09-21 admin authorization telemetry cleanup

PR #170 merged as `844d89c40c232effb1c522c8ffbd89a5429cb32d` after exact-head CI run `35585600946` passed the complete test, typecheck, CLI/worker build, scanner/Phase 11 benchmark, Next build, CSP browser, and production diagnostic gate.

The admin layout now uses a typed non-throwing access-state read for expected page navigation only. Unauthenticated users still redirect to sign-in, signed-in non-admins still fail closed to not-found, and privileged server operations continue to use throwing `requirePlatformAdmin()` authorization.

Vercel production deployment `dpl_Bz7UwyYA4k8aiJXKvga5VcoEisgh` is READY on the exact merge SHA and serves `scopeforge.dev`. A fresh unauthenticated `/admin/phase11` request rendered the sign-in page and produced zero runtime error groups in the verification window. The dedicated worker continued authenticated claim HTTP 200 traffic on the same deployment.

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
- last observed lease heartbeat: `2026-09-20 21:49:13.335068+00`
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

## Canary failure evidence and corrected diagnosis

The first canary exposed a mediator host-directory mismatch. PR #159 moved the host mediator root into the systemd-owned runtime directory.

The second canary then exposed a Linux Unix-socket pathname limit. The old generated pathname was 109 bytes and reproduced `listen EINVAL` on the accepted Oracle Linux host. PR #163 shortened only the private host subdirectory to `/run/scopeforge-worker/mediator`, producing a 101-byte path while preserving the 256-bit filename, in-container path, sandbox limits, and authorization boundary.

A third bounded canary after the socket-length release still failed before sandbox execution:

- run `3a96f604-857c-4a36-8d23-3c2127ab08de`
- action `phase11-action:fef9fd799e90c749af29156b0376b312187ed43c0cc0b016e352408b88f6dd05`
- task `36c86535-d7b9-4c11-bb16-c2ce03c74f3d`
- attempt `37469474-2a71-4b6d-9cf8-176b01fa19d8`
- one request charged
- task `dead_letter`
- attempt `failed` with `WORKER_EXECUTION_FAILED`
- all worker metrics zero
- no observation produced
- attempt duration about 313 ms

Exact production logs for that attempt showed:

- `POST /api/internal/workers/phase11-http/prepare` returned HTTP 409
- no worker heartbeat occurred
- `POST /api/internal/workers/phase11-http/finalize` returned HTTP 200

The proven root cause was a state-machine contradiction. The claim RPC intentionally changes the authoritative action state to `running` before preparation, while `lib/phase11-http-worker/preparation.ts` accepted only `enqueueing` or `queued`. The prepare route converts the resulting `PHASE11_HTTP_ACTION_STATE_INVALID` error to HTTP 409.

PR #164 fixed only that contradiction by accepting the authenticated post-claim `running` state. The regression fixture now defaults to `running`, while the existing authorization, target, lease, budget, network, and sandbox checks remain unchanged.

Live Supabase function-definition checks confirm that the claim RPC sets the action to `running`, the preparation-context RPC requires a leased task, verifies the Phase 11 worker class, rejects finished attempts, and validates the lease hash.

Live reconciliation after the 2026-09-22 attempt confirmed the production Phase 11 queue contains no queued or leased tasks. Preserve the first three `dead_letter` canaries and the fourth terminal canary as audit evidence.

## Private worker-table privilege note

Supabase flags several private worker tables because RLS is disabled. A direct live privilege query on the nine flagged tables returned zero grants for both `anon` and `authenticated`. Do not enable RLS automatically without a separately tested service-role policy design because an unreviewed change could break trusted worker access.

## Immutable runtime boundary

Accepted runtime image remains:

`localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`

Do not replace it with a mutable tag or enable additional execution classes to close Phase 11.

## Remaining Phase 11 operational gate

The PR #163 socket fix and PR #164 preparation-state fix are released. The fourth canary proved the worker/action path and exposed the remaining parent-run terminal-semantics defect.

The remaining end-to-end acceptance sequence is:

1. Release the scoped stop-condition precedence fix, verify the updated exact-main application is serving production with no active Phase 11 work, and only then apply its forward-only clean-budget-completion migration. Do not roll back to pre-fix application code while the new mapping remains active.
2. In a separately authorized future run, use `/admin/phase11` to queue exactly one verified ScopeForge-owned HTTPS root-only canary.
3. Keep the canary at `web.http.probe.v1`, root-only GET, redirects disabled, exactly one request, and a 5-second action runtime ceiling.
4. Require `acceptance_ready = true` plus clean Vercel and Oracle evidence.
5. Record the exact successful evidence, remove `public/.well-known/scopeforge-verification.txt`, and only then mark Phase 11 operationally 100% complete.

Do not manually insert a worker task, target third-party assets, or weaken containment to bypass this gate.

Canonical handoff: `docs/development/CODEX_HANDOFF_PHASE11.md`.
