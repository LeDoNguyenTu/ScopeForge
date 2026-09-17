# ScopeForge Current State

## 2026-09-18 accepted Phase 10A3 recovery checkpoint

- Released `main` remains `327b06d150f24d4cb3161cac078198ae0d473613`; issue #79 is closed and PR #76 is released.
- PR #77 is open/ready and was mergeable before this documentation update. Accepted source head: `37c3e68a6e188b30a1c23399449cc794fa776335`.
- Exact-source CI `35286439598` and Vercel passed. Production deployment `dpl_HkfuaAJ33qY8cs3xbWJFAPKqRTzV` is READY at `scopeforge.dev`.
- Full validation passes 437 files/1,996 tests, audit, typecheck, CLI/worker/Next builds, both benchmarks, Linux CSP browser smoke, and the production diagnostic.
- Codex Security diff scan `7231ee4e-2c72-4014-8f8f-15b055638982` completed with zero findings.
- Production same-head recovery is accepted: project and intent are `idle`, automatic pending is false, desired/successful SHA both equal `f13f3d72d0782e4260898201d8dd2f08885a8088`, and errors are clear.
- Recovery reused the existing third exact-head snapshot. Exact-head successful scans increased from two to three while exact-head snapshots stayed at three.
- Authenticated production UI shows **Scan project** and the newest successful run. Detailed evidence is in `docs/development/PR_77_RELEASE_ACCEPTANCE.md`.
- Remaining: push the final documentation checkpoint, require exact-head CI/Vercel, merge PR #77, then verify released `main` and production. PR #124 follows the Phase 10A3 release.

The older checkpoint below is historical and must not override this section.
Last reconciled: 2026-09-18, Asia/Singapore.

## Current Phase 10A3 checkpoint

- `main`: `327b06d150f24d4cb3161cac078198ae0d473613`.
- Issue #79: CLOSED; PR #76: MERGED/released.
- PR #77: OPEN/ready, cleanly mergeable; source head `1fd0a5472d8dbdb4359992de96f1ad494f72df24`, current documentation head `8b6a3dca3fa72901b064f92ac486e408f360a3a8`.
- Exact source validation and the final 24-file security scan are green; security scan ID `3d751254-8c97-4b99-b464-a97955b7839d` has zero findings.
- All seven Phase 10A3 migrations are deployed to `tdgpibrepzcvdivztkta`. Privileged functions are `service_role` only with empty search paths; private reconciliation tables have RLS enabled and no DML grants to browser or service roles.
- Production Vercel and the ScopeForge GitHub App have the matching webhook secret and `https://scopeforge.dev/api/integrations/github/webhook` URL. Push and Repository subscriptions are saved; Installation and Installation repositories are automatic GitHub App events.
- Production deployment `dpl_Cyn83SBDv8C2X6fKFLiikK5DncuA` is READY at `scopeforge.dev`. Signed ping/unsupported-event and invalid-signature/oversize edge canaries passed with statuses `200/202/401/413`.
- GitHub provider deliveries for `ping` and `installation.new_permissions_accepted` succeeded; the installation delivery returned HTTP 200 in 0.5 seconds. The temporary secret file is deleted and the clipboard is clear.
- PR #77 is ready. CI run `35257848754` and Vercel passed at exact head `8b6a3dca3fa72901b064f92ac486e408f360a3a8`.
- Activation checkpoint `a9f86a58e735076e4fdb8ceee7d0179aa27cb2c5` is also green in exact-head CI run `35261201693` and Vercel.
- Two rapid private-canary pushes (`3677257...`, `f13f3d7...`) reached the production webhook as `202/200`; private snapshot finalize, scan artifact, scan finalize, and follow-up snapshot finalize routes all returned HTTP 200. Exact newest-head terminal read-model confirmation remains required before merge.
- Existing advisor backlog remains: reviewed collaborator SECURITY DEFINER RPCs, leaked-password protection, and measured foreign-key/index performance follow-up.

Older queue details below are historical and must not override this checkpoint.

## Release queue

- `main`: `1b23dc8e5aa4c130d7ff6174cbf9444879b88bae` at reconciliation.
- Issue #79: CLOSED.
- PR #76: OPEN/DRAFT, mergeable/clean; executable head `e8d47e4a42ac97b3eabfb41a884555fe24ef93ec`.
- PR #77: OPEN/DRAFT at `1fcad5ff876cdfc2dba948213f987c2d5af2ae7a`; reconcile after #76.
- PR #124: docs-only Phase 11 plan.

Release order: final #76 CI -> merge/release #76 -> reconcile/accept #77.

## Phase 10A2 production

- Supabase: `tdgpibrepzcvdivztkta`.
- All five Phase 10A2 migrations are applied through `20260917065241`.
- Three repository gates are enabled after acceptance.
- Two workers are enabled; zero tasks are active.
- Both services are active; no containers or task directories remain.
- Vercel `dpl_B3sfM7kVZubuBqGBkw3WtB4wJMk1` is READY.

The private canary at `d95ca07123e28ee64de799e87651c2a3b6edb5cf` completed the real archive -> immutable snapshot -> zero-egress scan -> finding flow. Run `024e283b-353c-485d-b3ed-36f4e68bc1f7` produced one high/high CWE-78 finding with zero scanner errors. The finding list and detail page are browser-verified.

Security Advisor has no new Phase 10A2 authorization defect. The remaining notices are documented non-blockers.

The main worktree has user-owned `AGENTS.md`, `CLAUDE.md`, and `.claude/` changes. Preserve them.
