# ScopeForge Current State

Last reconciled: 2026-09-16, Asia/Singapore

Always fetch live refs before acting. This file records the last verified semantic state.

## Release queue

- `main` at checkpoint: `1b23dc8e5aa4c130d7ff6174cbf9444879b88bae`
- issue #79: CLOSED
- PR #76: OPEN/DRAFT, Phase 10A2
- #76 pre-doc executable candidate: `4ef285473402336b4488af4e1c2b4b1ea28d5eb7`
- exact-head CI: `35102938452` SUCCESS
- exact-head Vercel: `dpl_Cgt5cBd5guXKvVEfRDJS8fEXKENE` READY
- #76 was 159 ahead / 0 behind `main` at verification
- PR #77: OPEN/DRAFT at `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`, blocked behind #76

Release order: `complete Phase 10A2 operational acceptance -> release #76 -> reconcile/accept/release #77`.

## Production Phase 10A2 schema

ScopeForge Supabase: `tdgpibrepzcvdivztkta`.

Applied production migrations:

- `20260916122505 phase_10a2_private_repository_snapshot`
- `20260916122512 phase_10a2_private_project_scan_routing`

Verified live catalog/ACL state includes the private GitHub link binding, required execution classes, service-role-only orchestration wrappers, and no direct private-table DML grants for browser/service roles.

Security Advisor has no newly identified Phase 10A2 authorization bypass. Existing collaborator SECURITY DEFINER warnings are intentional RPCs that enforce `auth.uid()` plus owner/admin authorization internally. Performance lints are INFO-level.

## Production runtime state

At last verification:

- Phase 10A2 worker nodes: 0
- Phase 10A2 worker tasks: 0
- no private repository link has been fabricated
- no worker plaintext credential has been generated or stored outside an authorized host

Do not infer runtime acceptance from migrations, green CI, or Phase 6D evidence.

## Private canary

Dedicated canary repository: `LeDoNguyenTu/scopeforge-private-canary` (private).

Fixture commit: `d95ca07123e28ee64de799e87651c2a3b6edb5cf`.

Expected deterministic finding after a successful end-to-end scan: high-confidence `jsts/command-injection`, CWE-78.

The ScopeForge GitHub App connection uses selected-repository access. No verified evidence yet shows that the private canary repo was added to that selection.

## Worker host

Historical accepted Oracle host:

- public IP `168.107.81.228`
- SSH user `ubuntu`
- prior access via OCI Cloud Shell and the owner's SSH private key
- prior Linux/runtime: Ubuntu 24.04, rootless Podman, cgroup v2

Current session result: public TCP/22 connection refused. This session does not possess the SSH key and no OCI host-control connector is available.

## Completed work not to repeat

- #113 trusted private claim binding
- #114 authority-expiry hardening
- #115 archive stream cleanup
- #119 scan artifact expiry enforcement
- #120 private executor drain/finalization ordering
- #121 UID-independent worker runtime directory
- issue #79 provider authorization acceptance
- Phase 10A2 migrations/database ACL validation
- private canary fixture preparation

## Immediate resume point

Do not write more application features merely to avoid the operational gate. Regain authorized host access, deploy and accept the exact worker candidate, add/verify the canary repository in the legitimate GitHub App selection, run the bounded private end-to-end canary, verify rollback/privacy/cleanup, then release #76 only if all evidence passes.
