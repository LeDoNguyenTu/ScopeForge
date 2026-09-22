# ScopeForge Unfinished Work

Last reconciled: 2026-09-22, Asia/Singapore.

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

The 2026-09-22 single-Codex run queued exactly one additional authenticated canary and must not queue another. The worker, sandbox, bounded HTTP request, observation persistence, accounting, Vercel prepare/finalize routes, and Oracle cleanup all succeeded, but the parent run terminalized as `failed / request_budget_exhausted`.

Evidence: run `2409c669-306b-4a7f-bf83-e3bcf1efc0cc`, action `phase11-action:0d3b8a92c08aed7f9b351991eb7291c2c5ad6e007bcd7f5f376d0793542da9b4`, task `d15b183e-d1cd-4f52-a617-64ec2260d309`, attempt `f81f2f16-30de-41cf-a5ab-ee641e2e7804`, and observation `phase11-obs-http:51f1b31271876b0eee32170ac86a44bf23a19bb4a321fac568d596dafe7b443e`. The evidence query returned one request, zero provider failures, zero active tasks, and `acceptance_ready = false` solely because the run was not `completed`.

The root cause is confirmed: stop-condition precedence let request-budget exhaustion mask a simultaneous provider failure, while the database stop RPC mapped every request-budget stop to failure. The released source fix prioritizes provider failure, and applied migration `20260922150155` completes only clean request-budget exhaustion. Preserve the terminal canary row unchanged; a later separately authorized run must perform the next canary.

Do not remove `public/.well-known/scopeforge-verification.txt` until that later canary passes.

Phase 11 source implementation is complete, and the two operational defects found by the first production canaries are now released:

- PR #163 fixed the Linux Unix-socket pathname length by using `/run/scopeforge-worker/mediator/<64-hex>.sock`.
- PR #164 fixed the post-claim preparation state machine by accepting the authoritative `running` action state after a successful lease.
- PR #164 exact-head CI run `35542030195` passed every required validation step.
- PR #164 merged as `3cc1443ed292a14fe6738bc64a0b8629b5992d56`; later documentation-only reconciliation commits may move live `main` without changing Phase 11 runtime behavior.
- The PR #164 runtime deployment `dpl_8AYvooHJ38pJEk5yPfEe7o2JdiWe` is READY; later docs-only production deployments may be newer without changing the runtime fix.
- The dedicated Phase 11 worker has successfully authenticated and performed idle claims against the released deployment.

Preserve the first three failed canaries and the fourth terminal canary as audit evidence. The newest pre-fix canary is:

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

The terminal-semantics fix, exact-main deployment, and production migration are complete. The remaining blocker is one successful end-to-end production canary in a separately authorized run.

## Next actions

1. Do not roll back to pre-fix application code while migration `20260922150155` remains active.
2. In a separately authorized future run, execute exactly one new canary with the existing bounded controls.
3. Require `acceptance_ready = true`, clean logs, and Oracle cleanup.
4. Only then remove `public/.well-known/scopeforge-verification.txt` and mark Phase 11 operationally complete.

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
