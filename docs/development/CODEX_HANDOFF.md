# ScopeForge Codex handoff

## Immediate resume point (2026-09-17)

PR #76 is still draft. Current executable head is `2a612c4daa3e552ac4ba48f1f05f77bdf46e52bb`. Production-target deployment `dpl_21qMnEpBWxaatm95b9yu8Pg7uxJF` is READY and currently serves `scopeforge.dev` with repository gates false/absent.

The Linux workers are installed and active. Worker/scanner artifact candidate is `aace5fb954539460b940467fd85994d45dd7af65`; scanner image digest is `sha256:07be9bee8d3a0803a107042de8ea3ca2ab41b5496aa28e21d9ea0e42bcdc76ce`. Registered worker IDs are `96823db9-b35f-4bde-a857-0b9b97d761de` and `e12db837-8e21-4dde-af92-984431fe3a89`. Never rotate or expose their host-only credentials during continuation.

The next UI action is already prepared: GitHub installation `161253400` has a local unsaved selection containing both `LeDoNguyenTu/ScopeForge` and `LeDoNguyenTu/scopeforge-private-canary`. Browser-control policy requires explicit action-time confirmation immediately before clicking Save because this edits cloud repository permissions. After confirmation, save once and verify two repositories remain selected.

Then perform the bounded three-gate Phase 10A2 canary, keep rollback ready, and obtain exact-head CI only after full operational acceptance. PR #123 is already green and merged into draft PR #77; #77 remains blocked behind #76. PR #124 is a reviewed docs-only Phase 11 plan whose own design preserves Phase 10 ordering; do not start its runtime/persistence work before the Phase 10 release sequence clears.

Last reconciled: 2026-09-16, Asia/Singapore

## PRIORITY 0 — do this first when host access is available

Read `docs/development/CODEX_PRIORITY_0_HOST_ACCEPTANCE.md` first. The Phase 10A2 Linux worker/private-repository acceptance is the first task Codex must attempt in any session that has an authorized OCI/SSH terminal. Do not spend that host-capable session redoing issue #79, schema deployment, existing Phase 10A2 hardening, or the canary fixture unless fresh evidence proves a regression.

If host access is still unavailable, preserve this Priority 0 blocker and continue only safe independent repo-side work that does not weaken, bypass, or falsely satisfy the release gate.

Live provider/repository state always wins. Read `AGENTS.md`, fetch/prune, inspect `main`, PR #76, PR #77, CI, deployments, production migration history, and the actual worktree before changing code.

## Exact state before this documentation refresh

- `main`: `1b23dc8e5aa4c130d7ff6174cbf9444879b88bae`
- Phase 10A2 tested executable candidate: `4ef285473402336b4488af4e1c2b4b1ea28d5eb7`
- current PR #76 documentation head immediately before this Priority 0 refresh: `32baceebc0f505b17ef2db48c04fef5602e26467`
- #76 is deliberately DRAFT until worker/runtime/private-flow acceptance passes
- exact executable-candidate CI: run `35102938452`, success
- executable-candidate Vercel preview: `dpl_Cgt5cBd5guXKvVEfRDJS8fEXKENE`, READY
- issue #79: CLOSED; both real authenticated negative GitHub authorization canaries passed
- PR #77: OPEN/DRAFT at `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`, still blocked behind #76

## Phase 10A2 production schema

ScopeForge Supabase is `tdgpibrepzcvdivztkta`. Never confuse it with the Job Command Center project.

The Phase 10A2 migrations are already applied in production:

- `20260916122505 phase_10a2_private_repository_snapshot`
- `20260916122512 phase_10a2_private_project_scan_routing`

Live verification confirmed:

- `repository_snapshot_tasks.github_repository_link_id` exists
- workspace-bound GitHub-link FK uses `ON DELETE RESTRICT`
- GitHub-link index exists
- worker/task execution-class checks include `repository_snapshot_github_private_v1` and `phase3_repository_scan_no_egress_v1`
- private worker/orchestration tables are not directly writable by `anon`, `authenticated`, or `service_role`
- public worker registration/enqueue wrappers are service-role-only
- private claim/finalize internals are not browser/service-role callable directly
- current Phase 10A2 worker count at last production inspection: 0
- current Phase 10A2 queued task count at last production inspection: 0

Security Advisor did not expose a new Phase 10A2 privilege bypass. The authenticated SECURITY DEFINER warnings are the intentional PR #118 collaborator RPCs; their function bodies authenticate `auth.uid()` and require workspace owner/admin membership. Leaked-password protection remains an account-level advisory, not a Phase 10A2 migration defect. Performance advisor findings are INFO-level and are not a release reason to mutate the green security candidate.

## Private canary

Use only `LeDoNguyenTu/scopeforge-private-canary` for the Phase 10A2 private-repository release canary.

Prepared canary commit:

`d95ca07123e28ee64de799e87651c2a3b6edb5cf`

`src/canary.ts` is intentionally inert static-analysis input. It contains the scanner-supported Express request-input -> `child_process.exec` path and is expected to produce a high-confidence `jsts/command-injection` / CWE-78 finding. Do not execute or deploy the fixture.

There is no evidence yet that this repo has been added to the ScopeForge GitHub App installation's selected-repository access. Do not fabricate a repository-link row to bypass that provider step.

## Remaining release blocker

The remaining blocker is operational worker acceptance, not application implementation or schema migration.

Historical worker host:

- Oracle VM public IP: `168.107.81.228`
- SSH user: `ubuntu`
- historical access: OCI Cloud Shell using the owner's private key
- historical host: Ubuntu 24.04, rootless Podman/cgroup v2 accepted during Phase 6D
- current public port 22 check from the latest ChatGPT session: connection refused
- the ChatGPT session did not possess the private SSH key and must not place it in Git/chat/Vercel/Supabase

A connected authorized terminal/remote-host surface is required to finish host deployment. Do not register fake workers, mint credentials with nowhere safe to deliver them, weaken runtime gates, or claim acceptance from historical Phase 6D evidence alone.

## Exact next actions once host access exists

1. read `CODEX_PRIORITY_0_HOST_ACCEPTANCE.md`
2. fetch exact PR #76 candidate and confirm no newer executable change supersedes `4ef28547...`
3. install/verify Node 24, rootless Podman, cgroup v2, dedicated `scopeforge-worker` account, systemd delegation, disk/memory/PID prerequisites
4. build `npm ci && npm run build:workers`
5. deploy `scopeforge-worker.cjs` and the scanner entry under `/opt/scopeforge/current`
6. build scanner image from the pinned Containerfile and record immutable local image digest
7. generate two worker secrets on the host; store only in root-owned mode-0600 host env files
8. register only credential hashes via `register_private_repository_snapshot_worker_node` and `register_repository_scan_worker_node`
9. start workers with all repository runtime gates still disabled and verify authenticated idle claims/heartbeats
10. add `LeDoNguyenTu/scopeforge-private-canary` to the ScopeForge GitHub App installation's selected repository set through the legitimate owner/admin flow
11. enable only the Phase 10A2 repository gates for a bounded canary window
12. prove private archive lease -> immutable snapshot -> zero-egress scan -> expected CWE-78 finding
13. verify cancellation, cleanup, quotas, provenance, privacy-reduced logs, credential isolation, rollback
14. merge/release #76 only after every check passes; otherwise restore gates false and keep #76 draft
15. only after #76 production verification, reconcile/fresh-validate #77

## Completed work not to repeat

- #113 trusted private claim workspace/asset binding
- #114 provider/broker authority expiry rechecks
- #115 private archive stream cleanup
- #119 expired repository scan download fail-closed enforcement
- #120 private executor drain before trusted finalization
- #121 UID-independent worker runtime directory
- issue #79 positive and negative provider authorization acceptance
- Phase 10A2 production migrations and database ACL verification
- private canary fixture creation

## External identifiers

- GitHub: `LeDoNguyenTu/ScopeForge`
- Supabase: `tdgpibrepzcvdivztkta`
- Vercel team: `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- Vercel project: `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- production domain: `scopeforge.dev`

Never store or paste provider tokens, worker plaintext credentials, GitHub App private keys, OAuth codes, signed capability URLs, or SSH private keys in persistent docs.
