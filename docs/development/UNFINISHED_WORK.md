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

One production canary was attempted and reached the dedicated worker, but the provider attempt failed before sandbox execution.

Exact evidence:

- run: `bbd5c0cd-717c-4ee3-a5a6-c1028331f5b4`
- action: `phase11-action:bb4b6588033f981264bab07a8584df3d5fea86696db79a8f90f2177ac508f9a9`
- worker task: `aa6f13c2-6512-498f-95a7-ea7f7cce4e7e`
- attempt: `52c4c9fd-7a46-4c56-b3fd-63f843162b70`
- exactly one request was charged
- attempt status: `provider_failed`
- error: `WORKER_EXECUTION_FAILED`
- observations: 0
- worker heartbeat proves the task was leased on the dedicated host

Root cause: the mediator host socket root was outside the systemd service's writable runtime directory.

PR #159 fixed this by moving the host mediator socket root to `/run/scopeforge-worker/runtime-mediator` without changing the in-container path or sandbox/authorization limits.

## Next actions

1. Confirm exact current main is healthy after PR #160.
2. Deploy the rebuilt worker supervisor bundle from current main to the accepted Oracle Linux host.
3. Restart only `scopeforge-worker@phase11-http`.
4. Confirm idle auth and cleanup.
5. Rerun one verified ScopeForge-owned HTTPS root-only canary.
6. Verify one request, valid terminal states, observation/no-signal result, coverage accounting, no secret/body leakage, and no leftover runtime artifacts.
7. Record acceptance evidence.
8. Remove `public/.well-known/scopeforge-verification.txt`.
9. Mark Phase 11 operationally complete.

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
