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

## 2026-09-21 findings UI continuation

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

Rendered authenticated visual acceptance remains pending. The browser-only local attempt was blocked before rendering because this checkout has no local Supabase public URL/key, and the available browser inventory did not expose the user's authenticated Chrome-extension session. Do not request or paste secrets to work around this. Use an authenticated browser extension or an exact-candidate deployment for desktop/mobile screenshots.

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

## Root cause already fixed in source

The hardened service has:

- `ProtectSystem=strict`
- `RuntimeDirectory=scopeforge-worker`
- writable runtime path `/run/scopeforge-worker`

The old supervisor used host mediator root:

`/run/scopeforge/runtime-mediator`

That path was not writable by the service.

PR #159 moved only the host mediator root to:

`/run/scopeforge-worker/runtime-mediator`

The in-container path remains:

`/run/scopeforge/mediator.sock`

No sandbox, network, authorization, or target-scope weakening was introduced.

## Exact remaining execution sequence

### 1. Reconcile release state

Confirm:

- current main SHA
- exact-main CI green
- Vercel production READY on current main
- Supabase project healthy
- no unexpected queued Phase 11 tasks
- existing worker identity still enabled

### 2. Deploy corrected supervisor to Oracle host

Use the accepted dedicated Linux host and the `scopeforge-worker` account.

Build from the exact released main with Node 24:

```sh
npm ci
npm run build:workers
```

Deploy the resulting:

`.scopeforge-worker-build/scopeforge-worker.cjs`

to the production bundle location used by the systemd service:

`/opt/scopeforge/current/scopeforge-worker.cjs`

Do not place secrets in Git, chat, PR comments, or shell history. Preserve the existing environment file and worker credential.

The unit is:

`scopeforge-worker@phase11-http`

Restart only this instance. Do not disrupt repository snapshot/scan workers.

### 3. Host preflight/cleanup

Confirm:

- non-root worker account
- rootless Podman on cgroup v2
- immutable accepted runtime image exists
- mediator host root is under `/run/scopeforge-worker/runtime-mediator`
- no stale Phase 11 runtime container
- no stale mediator socket
- authenticated idle claim succeeds

Do not relax `ProtectSystem=strict`, `ReadWritePaths`, cgroup limits, egress policy, or worker auth.

### 4. Run exactly one new canary

Use the platform-admin `/admin/phase11` control and an existing verified ScopeForge-owned HTTPS web/API asset.

The canary must remain:

- `web.http.probe.v1`
- root-only GET
- redirects disabled
- exactly one request ceiling
- 5-second action runtime ceiling
- no intrusive/validation capability
- no external Nmap/Nuclei/httpx
- no third-party target

Do not manually insert a worker task.

### 5. Acceptance criteria

Require all of:

- worker leases the new task
- exactly one request is charged
- attempt reaches a valid terminal result
- run/action/task reconcile terminally
- either a valid observation is persisted or the provider produces a legitimate no-signal result
- coverage request-count delta is exactly one
- no duplicate terminal accounting
- provider-failure accounting is correct
- no out-of-scope redirect/target authority
- no response body, credential, auth token, or secret leakage in ordinary logs/evidence
- no remaining runtime container
- no remaining mediator socket
- cancellation/recovery semantics remain intact

Do not manufacture a finding.

### 6. Close Phase 11

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
