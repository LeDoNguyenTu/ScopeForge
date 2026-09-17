# ScopeForge Codex handoff

Last reconciled: 2026-09-18, Asia/Singapore. Live GitHub/provider state still wins.

## 2026-09-18 Phase 10A3 release checkpoint (supersedes older resume text below)

- Released `main`: `327b06d150f24d4cb3161cac078198ae0d473613` (Phase 10A2 is released and production-verified).
- PR #77 branch: `feat/phase-10a3-github-webhook-reconciliation`.
- Last source head: `1fd0a5472d8dbdb4359992de96f1ad494f72df24`; remote matches and the worktree was clean before this documentation refresh.
- PR #77 is OPEN/DRAFT and mergeable/clean. Vercel is READY for the exact source head. GitHub CI was skipped because the PR remained draft.
- Full validation at `1fd0a547`: 437 files passed, 4 skipped; 1,994 tests passed, 24 skipped; audit 0; typecheck, CLI 0.1.0, worker build, scanner benchmark, benchmark matrix, and Next production build passed.
- Exact security scan `3d751254-8c97-4b99-b464-a97955b7839d` covered all 24 changed source/schema files in `327b06d..1fd0a547` and reported zero findings.
- All seven reviewed Phase 10A3 migrations are applied to ScopeForge Supabase `tdgpibrepzcvdivztkta`; live generated migration versions run from `20260917180241` through `20260917180257`.
- Production Vercel now has a cryptographically random secret `GITHUB_APP_WEBHOOK_SECRET`. Its value must never be printed or copied into documentation.
- Remaining release gate: configure the ScopeForge GitHub App webhook URL as `https://scopeforge.dev/api/integrations/github/webhook` with the same secret, then run signed/invalid/oversize/replay/lifecycle/coalescing/recovery/public-private/end-to-end canaries.
- Browser automation was unavailable because the local CUA kernel assets could not initialize. The secret remains in the local temporary secret file for secure clipboard transfer; delete that file immediately after GitHub App configuration.
- PR #77 was marked ready. Exact-head CI run `35257055269` passed at documentation head `657359bc44a5376205f8a449f1b4cae9cc2b3fa4`, and its Vercel preview was READY.
- Exact candidate production deployment `dpl_Cyn83SBDv8C2X6fKFLiikK5DncuA` is READY and aliased to `scopeforge.dev`.
- Non-mutating production canaries passed: signed ping `200`, signed unsupported event `202`, invalid signature `401`, and oversized request `413`.

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
