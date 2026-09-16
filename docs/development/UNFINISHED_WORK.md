# ScopeForge Unfinished Work

Last reconciled: 2026-09-16, Asia/Singapore

## Release-blocking work

### Phase 10A2 — dedicated worker/private-repository acceptance

Status: BLOCKED ON AUTHORIZED HOST ACCESS, not blocked on application code or database migration.

Prerequisites already complete:

- issue #79 authorization gate closed
- PR #76 pre-doc executable candidate `4ef285473402336b4488af4e1c2b4b1ea28d5eb7`
- exact-head CI `35102938452` passed
- exact-head Vercel preview READY
- both Phase 10A2 migrations applied in production
- production schema/ACL/advisor verification performed
- private canary fixture prepared at `LeDoNguyenTu/scopeforge-private-canary@d95ca07123e28ee64de799e87651c2a3b6edb5cf`

Still unfinished:

- regain authorized shell access to Oracle worker host `168.107.81.228` (`ubuntu`); current public TCP/22 refuses connections
- deploy/accept exact Phase 10A2 Node 24 worker bundle and immutable scanner image
- create host-only worker credentials and register hashes/worker identities
- prove idle authenticated worker operation with repository gates disabled
- add/verify the private canary in the ScopeForge GitHub App selected-repository set
- import/connect the private canary through normal application/provider flow
- run bounded private snapshot -> zero-egress scan -> deterministic CWE-78 finding canary
- prove cancellation, cleanup, quotas, provenance, privacy, secret boundaries, and rollback
- only then mark #76 ready, merge expected head, and verify production

### Phase 10A3 — PR #77

Status: intentionally blocked behind Phase 10A2 release.

Do not reconcile, migrate, configure webhook secrets, or release until #76 has merged and production verification passes.

## Non-blocking backlog

- evaluate INFO-level Supabase performance advisor suggestions in a separate measured change after Phase 10A2 release
- perform branch cleanup only after fresh branch/PR/worktree reachability proof

## Explicitly not unfinished

Do not redo:

- #113, #114, #115, #119, #120, #121
- issue #79 canaries
- Phase 10A2 migration application
- Phase 10A2 database ACL verification
- private canary fixture creation

## Safety boundary

Do not create fake production evidence. Do not store SSH/GitHub/provider/worker secrets in Git, chat, docs, PRs, Vercel, browser state, or ordinary logs. Do not use unrelated private repositories as acceptance fixtures.
