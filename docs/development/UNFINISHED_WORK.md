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

The first diagnosis was incomplete: the mediator host socket root was outside the systemd service's writable runtime directory.

PR #159 fixed this by moving the host mediator socket root to `/run/scopeforge-worker/runtime-mediator` without changing the in-container path or sandbox/authorization limits.

After deploying that bundle, a second one-request canary also failed before sandbox execution:

- run: `dd90af93-9f9e-4168-8a2a-067302210f85`
- action: `phase11-action:dfe0443e9f0f41f1012054da78ad4e2cc466242013b4fb0344c41bd09f774c8b`
- worker task: `f59e0413-27ef-43b2-bf32-d11d3d54a77e`
- attempt: `913086b3-52f1-4405-b613-025830cb2d38`
- one request charged; `provider_failed`; `WORKER_EXECUTION_FAILED`; zero worker metrics; no observation

The exact generated socket pathname is 109 bytes and the Oracle host reproduced `listen EINVAL`. The active TDD fix uses `/run/scopeforge-worker/mediator/<64-hex>.sock`, which is 101 bytes and listens successfully while keeping the 256-bit filename and all containment boundaries.

## Next actions

1. Merge `fix/phase11-unix-socket-path-length-20260921` only after exact-head CI passes.
2. Deploy the rebuilt worker supervisor bundle from exact released main to the accepted Oracle Linux host.
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
