# ScopeForge Unfinished Work

Last reconciled: 2026-09-21, Asia/Singapore.

## Phase 11 status

Phase 11 source implementation is complete for the initial approved release scope.

Released through PR #160:

- Tasks 1-9 core planning/policy/persistence/orchestration
- Task 10 bounded HTTP provider path plus reviewed Nmap/Nuclei contracts
- Task 11 adaptive/legal-lab evaluation
- Task 12 bounded stateful web/API discovery
- Task 13 session/browser authority
- Task 14 proof-only validation
- Task 15 continuous validation/remediation feedback
- Task 16 capability-gap evaluation/defer decisions

External Nmap, Nuclei, external httpx, broad exploit frameworks, cloud/cluster credentials, and advanced provider execution remain separately gated. They are not required merely to close the initial Phase 11 operational gate.

## Remaining active blocker

Phase 11 source implementation is complete, and the two operational defects found by the first production canaries are now released:

- PR #163 fixed the Linux Unix-socket pathname length by using `/run/scopeforge-worker/mediator/<64-hex>.sock`.
- PR #164 fixed the post-claim preparation state machine by accepting the authoritative `running` action state after a successful lease.
- PR #164 exact-head CI run `35542030195` passed every required validation step.
- PR #164 merged as `3cc1443ed292a14fe6738bc64a0b8629b5992d56`.
- Vercel production `dpl_8AYvooHJ38pJEk5yPfEe7o2JdiWe` is READY on that exact SHA.
- The dedicated Phase 11 worker has successfully authenticated and performed idle claims against the released deployment.

Preserve all three failed canaries as audit evidence. The newest one is:

- run: `3a96f604-857c-4a36-8d23-3c2127ab08de`
- action: `phase11-action:fef9fd799e90c749af29156b0376b312187ed43c0cc0b016e352408b88f6dd05`
- worker task: `36c86535-d7b9-4c11-bb16-c2ce03c74f3d`
- attempt: `37469474-2a71-4b6d-9cf8-176b01fa19d8`
- exactly one request charged
- task: `dead_letter`
- attempt: `failed`
- error: `WORKER_EXECUTION_FAILED`
- worker metrics: all zero
- observation: none

Production logs proved the failure boundary: the Phase 11 prepare route returned HTTP 409, no heartbeat followed, and finalization returned HTTP 200. The claim RPC had correctly moved the action to `running`; trusted preparation rejected that valid post-claim state. PR #164 is the TDD regression fix.

The remaining blocker is not another source task. It is one successful end-to-end production canary through the authenticated platform-admin control.

## Next actions

1. From an authenticated platform-admin session, run exactly one verified ScopeForge-owned HTTPS canary from `/admin/phase11`.
2. Keep it fixed at `web.http.probe.v1`, root-only GET, redirects disabled, one request maximum, and 5000 ms action runtime maximum.
3. Verify preparation succeeds past the prior HTTP 409 boundary and the worker reaches normal mediator/sandbox execution.
4. Verify one request, valid terminal task/action/run state, valid observation or legitimate no-signal result, and exact coverage reconciliation.
5. Verify ordinary logs/evidence contain no response body, credentials, authorization token, or other secret.
6. Verify the accepted Oracle host has no leftover Phase 11 runtime container or mediator socket.
7. Record the exact acceptance IDs and evidence in Phase 11 validation/status docs.
8. Remove `public/.well-known/scopeforge-verification.txt`.
9. Mark Phase 11 operationally complete only after all acceptance evidence passes.

Current project-management estimates remain unchanged until this gate passes:

- Phase 11 source: ~100%
- Phase 11 operational acceptance: ~94%
- overall "finish Phase 11" task: ~98%
- whole ScopeForge project: ~90%

## Do not repeat

- Do not reapply already deployed Phase 11A/11C migrations.
- Do not create a replacement worker identity unless explicit credential rotation is required.
- Do not weaken systemd, Podman, egress, authorization, or RPC boundaries.
- Do not use mutable container tags.
- Do not manually insert a worker task to fake the canary.
- Do not target third-party assets.
- Do not enable external Nmap/Nuclei/httpx merely to reach 100%.
- Keep ScopeForge Supabase `tdgpibrepzcvdivztkta` separate from Job Command Center.

## Obsolete branch/PR note

PR #152 is superseded by released Task 11 work (#153 and #160) and should not be used as a resume point.
