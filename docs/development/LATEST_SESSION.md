# ScopeForge Latest Session

## 2026-09-17 continuation checkpoint

- PR #76 executable head is `2a612c4daa3e552ac4ba48f1f05f77bdf46e52bb`.
- Exact local validation passed: audit, 426 test files (422 passed / 4 skipped; 1,854 tests passed / 24 skipped), typecheck, CLI build/version, worker build, scanner benchmark, benchmark matrix, and Next production build.
- Exact production-target Vercel deployment `dpl_21qMnEpBWxaatm95b9yu8Pg7uxJF` is READY and promoted to `scopeforge.dev` with all repository gates still false/absent.
- Linux host `168.107.81.228` is reachable. Node 24.16.0, rootless Podman, cgroup v2, dedicated `scopeforge-worker`, and UID-independent systemd runtime-directory behavior were verified.
- The exact worker/scanner build candidate is `aace5fb954539460b940467fd85994d45dd7af65`; later PR commits affect only the control-plane empty-request transport fix.
- Immutable scanner image digest is `sha256:07be9bee8d3a0803a107042de8ea3ca2ab41b5496aa28e21d9ea0e42bcdc76ce`.
- A zero-egress host scan of `scopeforge-private-canary@d95ca07123e28ee64de799e87651c2a3b6edb5cf` produced exactly one expected `jsts/command-injection` / CWE-78 finding with zero scanner errors.
- Production worker nodes `96823db9-b35f-4bde-a857-0b9b97d761de` (private snapshot) and `e12db837-8e21-4dde-af92-984431fe3a89` (repository scan) are registered at the worker candidate and running. Plaintext credentials exist only in root-owned mode-0600 host files.
- Live worker startup exposed and TDD-fixed Vercel's normalized empty POST stream handling. Both services now remain active and idle without restart/error churn while gates are off.
- The GitHub App selected-repository form is prepared with `ScopeForge` and `scopeforge-private-canary`, but the permission change has not been saved. The browser-control confirmation policy requires explicit action-time confirmation immediately before Save.
- PR #123 completed RED-to-GREEN at `5bf76d1a2f85ad2dd0cb1d054fb6d52f6c67f7f2`, passed exact CI run `35131641378`, and merged into Phase 10A3 PR #77 as `1fcad5ff876cdfc2dba948213f987c2d5af2ae7a` without changing release order.
- The user's uncommitted GitNexus additions in the main worktree (`AGENTS.md`, `CLAUDE.md`, `.claude/`) were discovered and preserved.

Date: 2026-09-16 (Asia/Singapore)

## What changed

This continuation moved Phase 10A2 past stale blockers and isolated the actual remaining dependency.

### Reverified live release state

- issue #79 is closed after both real authenticated negative authorization canaries passed
- PR #76 pre-doc executable head: `4ef285473402336b4488af4e1c2b4b1ea28d5eb7`
- CI run `35102938452`: success
- Vercel deployment `dpl_Cgt5cBd5guXKvVEfRDJS8fEXKENE`: READY
- PR #76 is reconciled onto current main at the recorded checkpoint (159 ahead / 0 behind)
- PR #76 was returned to DRAFT because operational worker acceptance is still incomplete
- PR #77 remains DRAFT and blocked only behind #76

### Production schema acceptance

The previously stale handoff said Phase 10A2 migrations were unapplied. Live Supabase migration history proves both are already applied:

- `20260916122505 phase_10a2_private_repository_snapshot`
- `20260916122512 phase_10a2_private_project_scan_routing`

Live catalog checks verified the GitHub-link FK/index, private/public execution classes, worker registration/claim ACL boundaries, and lack of direct private-table DML grants to browser/service roles.

Security Advisor produced no new Phase 10A2 privilege bypass. Performance findings are INFO-level only.

### Private canary prepared

A purpose-built private repository already existed: `LeDoNguyenTu/scopeforge-private-canary`.

Added inert scanner fixture at commit:

`d95ca07123e28ee64de799e87651c2a3b6edb5cf`

The fixture is static TypeScript source only and matches the supported Express request-input -> `child_process.exec` rule. Expected result is `jsts/command-injection`, high confidence, CWE-78.

No unrelated private repository was used.

### Worker runtime status

Live production counts at the end of this continuation:

- Phase 10A2 workers: 0
- Phase 10A2 tasks: 0

No fake worker registration, credential creation, task insertion, repository-link fabrication, gate weakening, or production merge was performed.

### Host access finding

Historical Phase 6D worker host is Oracle VM `168.107.81.228`, SSH user `ubuntu`, previously accessed from OCI Cloud Shell using the owner's private key.

A fresh connection attempt from this session found TCP/22 refusing connections. This session has no SSH private key and no OCI control connector. A Remote Desktop/terminal connector was surfaced as the appropriate way to expose an authorized host shell without copying secrets into chat.

## Remaining exact blocker

Phase 10A2 code/schema/provider authorization are no longer the blocker. The release is waiting on:

1. authorized Linux host access
2. exact-candidate worker deployment/containment revalidation
3. adding the dedicated private canary to the ScopeForge GitHub App's selected repositories if not already present
4. bounded private acquisition -> immutable snapshot -> zero-egress scan -> expected finding canary
5. cleanup/privacy/rollback verification

After those pass: merge and production-verify #76, then reconcile/fresh-validate #77.
