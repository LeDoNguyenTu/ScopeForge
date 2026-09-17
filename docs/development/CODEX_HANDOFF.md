# ScopeForge Codex handoff

## 2026-09-18 accepted PR #77 recovery checkpoint

Live provider state wins over this handoff.

- Worktree/branch: `D:\PROJECTS\ScopeForge-pr77` / `feat/phase-10a3-github-webhook-reconciliation`
- Accepted source head: `37c3e68a6e188b30a1c23399449cc794fa776335`; base/released `main`: `327b06d150f24d4cb3161cac078198ae0d473613`
- Exact-source CI `35286439598` and Vercel passed. Production deployment `dpl_HkfuaAJ33qY8cs3xbWJFAPKqRTzV` is READY.
- Root cause: generic connected-project cleanup ran before automatic/manual-aware settlement in both repository-scan finalize routes, erasing exact identifiers before the successful watermark could settle.
- Fix: run aware settlement first, stop before cleanup when retry is required, then invoke idempotent generic cleanup.
- TDD: both route-order assertions were witnessed RED; focused suites passed 33 tests; full suite passed 437 files/1,996 tests with expected skips.
- Security: GitNexus impact/detect-changes reviewed both worker entry points; Codex Security scan `7231ee4e-2c72-4014-8f8f-15b055638982` found zero issues.
- Production recovery: desired/successful SHA now equal `f13f3d72d0782e4260898201d8dd2f08885a8088`; project/intent are idle; automatic pending is false; no error remains.
- No reacquisition: exact-head snapshots stayed at 3 while successful exact-head scans increased from 2 to 3. Authenticated UI returned to **Scan project**.
- Full acceptance detail: `docs/development/PR_77_RELEASE_ACCEPTANCE.md`.
- Remaining gate: push this documentation checkpoint, require exact-head CI/Vercel, merge PR #77, and verify released `main` plus production. Then reconcile PR #124.

Older handoff content below is historical and must not override this checkpoint.
Last reconciled: 2026-09-18, Asia/Singapore. Live GitHub/provider state still wins.

## 2026-09-18 Phase 10A3 release checkpoint (supersedes older resume text below)

- Released `main`: `327b06d150f24d4cb3161cac078198ae0d473613` (Phase 10A2 is released and production-verified).
- PR #77 branch: `feat/phase-10a3-github-webhook-reconciliation`.
- Last source head: `1fd0a5472d8dbdb4359992de96f1ad494f72df24`; remote matches and the worktree was clean before this documentation refresh.
- PR #77 is OPEN/ready and mergeable/clean. Current documentation head is `8b6a3dca3fa72901b064f92ac486e408f360a3a8`.
- Full validation at `1fd0a547`: 437 files passed, 4 skipped; 1,994 tests passed, 24 skipped; audit 0; typecheck, CLI 0.1.0, worker build, scanner benchmark, benchmark matrix, and Next production build passed.
- Exact security scan `3d751254-8c97-4b99-b464-a97955b7839d` covered all 24 changed source/schema files in `327b06d..1fd0a547` and reported zero findings.
- All seven reviewed Phase 10A3 migrations are applied to ScopeForge Supabase `tdgpibrepzcvdivztkta`; live generated migration versions run from `20260917180241` through `20260917180257`.
- Production Vercel now has a cryptographically random secret `GITHUB_APP_WEBHOOK_SECRET`. Its value must never be printed or copied into documentation.
- The ScopeForge GitHub App webhook now targets `https://scopeforge.dev/api/integrations/github/webhook` with the matching production secret. Push and Repository subscriptions are saved. GitHub delivers Installation and Installation repositories to all GitHub Apps without separate subscription checkboxes.
- GitHub recorded successful provider deliveries for `ping` and `installation.new_permissions_accepted`; the latter completed with HTTP 200 in 0.5 seconds. The local temporary secret file was deleted and the clipboard cleared without displaying the value.
- Remaining release gate: run replay/lifecycle/coalescing/recovery/public-private/end-to-end production canaries, then merge and verify released production.
- PR #77 was marked ready. Exact-head CI run `35257055269` passed at documentation head `657359bc44a5376205f8a449f1b4cae9cc2b3fa4`, and its Vercel preview was READY.
- Exact candidate production deployment `dpl_Cyn83SBDv8C2X6fKFLiikK5DncuA` is READY and aliased to `scopeforge.dev`.
- Non-mutating production canaries passed: signed ping `200`, signed unsupported event `202`, invalid signature `401`, and oversized request `413`.
- Exact-head CI run `35257848754` and Vercel passed at `8b6a3dca3fa72901b064f92ac486e408f360a3a8`.
- GitHub App activation checkpoint commit `a9f86a58e735076e4fdb8ceee7d0179aa27cb2c5` is pushed. Exact-head CI run `35261201693` and Vercel passed.
- Private automatic-scan canary: rapid default-branch commits `3677257c7fb1250b94ad483e505ecfe923f889a5` then `f13f3d72d0782e4260898201d8dd2f08885a8088` were pushed to `LeDoNguyenTu/scopeforge-private-canary`. Production received two signed webhook requests (`202`, then `200`), then returned `200` for snapshot finalization, repository-scan artifact access, repository-scan finalization, and a later snapshot finalization. This proves live GitHub -> webhook -> private worker -> scan execution and exercises the rapid-push/coalescing path.
- Do not yet claim exact newest-head convergence from those route logs alone. Confirm the production read model or private reconciliation state shows `f13f3d72...` terminal before merging. The requested Browser extension currently fails initialization with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`.

## Immediate resume point

Phase 10A2 PR #76 is open and draft. Its last executable head is `e8d47e4a42ac97b3eabfb41a884555fe24ef93ec`; production deployment `dpl_B3sfM7kVZubuBqGBkw3WtB4wJMk1` is READY at `scopeforge.dev`.

All Phase 10A2 operational gates passed. Next: commit this handoff, mark #76 ready, require green CI for the final head, merge, and verify merged-main CI and production. Then reconcile PR #77 onto released `main`.

## Proven production acceptance

- Issue #79 is CLOSED after positive and negative GitHub App canaries.
- The legitimate installation includes `LeDoNguyenTu/scopeforge-private-canary`.
- All three repository runtime gates remain enabled after acceptance.
- Two production workers are enabled and active.
- Worker release: `2e640e8929f6f7da579d7904a6d49532ec055c5d`; credentials remain host-only.
- Scanner: `localhost/scopeforge-scanner@sha256:07be9bee8d3a0803a107042de8ea3ca2ab41b5496aa28e21d9ea0e42bcdc76ce`.
- Canary source: `d95ca07123e28ee64de799e87651c2a3b6edb5cf`.
- Run `024e283b-353c-485d-b3ed-36f4e68bc1f7` completed in 539 ms and published one expected high/high `jsts/command-injection` finding, CWE-78, from 2 files and 475 bytes with zero scanner errors.
- Authenticated production UI renders the completed scan, finding ledger, and full finding detail.
- Failure/cancellation and expired-lease recovery were exercised. Production has zero active Phase 10A2 tasks.
- Both services are active, `RuntimeDirectoryPreserve=yes`, no scanner containers remain, and the task workroot is clean.
- Strict nonce CSP and expected security headers remain present.

## Production schema

ScopeForge Supabase is `tdgpibrepzcvdivztkta`. Applied Phase 10A2 migrations:

- `20260916122505 phase_10a2_private_repository_snapshot`
- `20260916122512 phase_10a2_private_project_scan_routing`
- `20260916225352 phase_10a2_project_snapshot_terminal_recovery`
- `20260917063627 phase_10a2_project_scan_terminal_recovery`
- `20260917065241 phase_10a2_project_scan_success_completion`

Security Advisor found no new Phase 10A2 authorization bypass. Existing notices are the deliberate private no-policy table, reviewed collaborator RPCs, and account-level leaked-password protection setting.

## Exact validation

- focused finding tests: 10 passed
- full suite: 425 files passed, 4 skipped; 1,869 tests passed, 24 skipped
- audit: 0 vulnerabilities
- typecheck, CLI build/version, worker build, Next build: passed
- scanner/profile benchmarks: passed on unchanged scanner/worker code
- Vercel production and authenticated browser: verified

Preserve user-owned root-worktree changes to `AGENTS.md`, `CLAUDE.md`, and `.claude/`. Never expose secrets, fabricate state, rewrite deployed migrations, weaken authorization/containment, or confuse this project with `xwsergbpvkcsugexssmc`.
