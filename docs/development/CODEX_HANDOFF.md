# ScopeForge Codex handoff

## Latest continuation checkpoint - 2026-09-15

Continuation added regression PR #110 at `39e14307756d1bc47209209307e18c14c38c725e`: ten callback authorization cases, focused 25 tests and full Windows 1,734 tests passed, typecheck passed. Read the phone handoff for exact CI completion and remaining approval/session prerequisites. #110 does not clear #79.

Read [PHONE_SESSION_HANDOFF.md](PHONE_SESSION_HANDOFF.md) for the phone-ready prompt and verified continuation state. PR #97 is complete; the older preparation-time priority below is historical. PR #109 is now the active dependency-maintenance candidate, with passing exact-head CI but a normal merge rejected by the main-branch policy. Do not bypass that policy. Issue #79 still gates #76 then #77. This session changed documentation only and did not reverify production providers. Preserve the active dependency and handoff branches in addition to the earlier four-ref baseline.

Prepared: 2026-09-14, Asia/Singapore

This is the entry point for handing ScopeForge back to Codex after a period of work in other ChatGPT sessions/tools.

The core rule is simple: **synchronize first, then continue**. This document records a preparation-time snapshot, not a permanent assertion that the recorded SHAs and PR states are still current.

## 1. Mandatory live synchronization

At the start of every Codex session:

```bash
git remote -v
git status --short --branch
git fetch --all --prune
git branch -vv
git rev-parse HEAD
git rev-parse origin/main
```

Then inspect live GitHub state for:

- current `main`
- all open pull requests, not only the historically important ones
- issue #79 and any newer release blockers
- current CI/check state for each active candidate
- recent merged PRs that may have changed assumptions in the handoff docs

Do not start by checking out a SHA copied from this file. Resolve live refs first.

Read, in order:

1. `AGENTS.md`
2. this file
3. `docs/development/ACCOUNT_CONTEXT_CHECKLIST.md`
4. `docs/development/CURRENT_STATE.md`
5. `docs/development/NEXT_STEPS.md`
6. `docs/development/SESSION_HANDOFF.md`
7. `docs/development/UNFINISHED_WORK.md`
8. the live bodies, comments, diffs, checks, and review state of every active PR/issue involved in the next task

If documentation conflicts with live repository/provider evidence, live evidence wins. Repair the documentation as part of the task when the difference is semantic and useful for the next session.

## 2. Preparation-time repository snapshot

At handoff preparation time:

- repository: `LeDoNguyenTu/ScopeForge`
- live `main`: `ec7b00d1f533704100e224bc53f6a6647a3e1a4b`
- latest merged change at that tip: PR #96, immutable pinning for ScopeForge's own first-party GitHub Actions
- accepted runtime baseline: Node 24

Older resume documents correctly say not to use their embedded SHA as the current tip. Keep that rule.

### Active PR #97 requires immediate reconciliation

At preparation time PR #97, **Harden published CI example action pins**, is open:

- branch: `chore/public-ci-action-pinning`
- recorded head: `bbfc99e849e28c40dd3228daeae6cf0da77446c6`
- it was created from the pre-PR-#96 main base
- it contains the RED regression test for the public CI guide only
- Vercel preview is READY
- GitHub CI #1034 / run `34777499920` is failing exactly at `tests/architecture/public-ci-action-pinning.test.ts`
- the run passed the other 1,744 tests before stopping on that one expected RED guard

The failing guard proves that `docs/scanner/CI.md` still uses movable action tags such as `actions/checkout@v7`, `actions/setup-node@v7`, and `github/codeql-action/upload-sarif@v4`.

**First Codex maintenance action:** re-read live PR #97 and live `main`, then reconcile the branch onto current main and complete the planned GREEN phase. Pin the public CI guide's first-party actions to verified immutable 40-character commits while retaining readable major-version comments. Resolve those commits from the official action repositories/current major tags instead of inventing values. Run focused tests first, then the appropriate full validation. Merge/close/supersede #97 only according to its actual live state and evidence.

Do not confuse PR #97 with PR #96. PR #96 hardened ScopeForge's own workflow. PR #97 is the independent public documentation example and guard.

## 3. Primary unfinished release queue after maintenance reconciliation

After the live maintenance queue is clean, the known release sequence is:

### A. Issue #79 - remaining GitHub App negative production canaries

The positive owner/admin provider connection and repository import canary is already complete. Do not redo or misrepresent it as pending.

Two live authenticated production checks remained at handoff time:

1. while authenticated as owner/admin, attempt the normal callback/continuation path with a different valid numeric GitHub installation ID and prove ScopeForge rejects it as not belonging to the authorized connection/workspace
2. while authenticated as a normal workspace member/viewer, prove Connect GitHub cannot be initiated or completed

These must use the real application authorization path. Unit tests are not a substitute. Do not weaken authorization, fabricate database state, downgrade an owner solely to create the test, or expose provider secrets.

If a suitable browser/member identity is unavailable, keep #79 open and continue only independent safe work. If either canary reveals a defect, keep Phase 10A2 runtime gates off and remediate before proceeding.

### B. Phase 10A2 - PR #76 private repository acquisition

PR #76 is gated behind #79. At the previous reconciliation its branch was `feat/phase-10a2-private-repository-acquisition`, with historical recorded head `709ef8af4ce4befae12ba910d3bca15599b5cab1`. Fetch the actual live head instead of assuming this remains current.

Reviewed Phase 10A2 migrations waiting behind the gate were:

- `20260911100000_phase_10a2_private_repository_snapshot.sql`
- `20260911110000_phase_10a2_private_project_scan_routing.sql`

Read-only migration/schema compatibility preflight had already passed. Do not repeat the same preflight unless PR #76 or production schema changed materially.

After #79 is genuinely cleared:

1. fetch live main and re-read/reconcile actual PR #76
2. run exact-candidate validation
3. re-read production migration history
4. apply only absent reviewed migrations to **ScopeForge Supabase `tdgpibrepzcvdivztkta`**
5. verify schema, RLS, grants/revokes, service-role boundaries, and Supabase security posture
6. verify the selected private repository remains available to the GitHub App under intended read-only permissions
7. complete private acquisition worker containment, quotas, cancellation/cleanup, observability, and rollback acceptance
8. prove private archive lease -> immutable snapshot -> exact zero-egress repository scan -> findings
9. prove provider credentials remain control-plane-only and private source/capability material does not leak to browser state or ordinary logs
10. merge/release only when provider, code, schema, runtime, privacy, and rollback gates are all green
11. verify production after release

If only a host-level containment probe requires SSH, hand off only that exact probe to the approved host environment. Historical Phase 6D Task 15 Linux acceptance is complete and must not be rerun as generic setup work.

### C. Phase 10A3 - PR #77 GitHub webhook reconciliation

PR #77 must follow released Phase 10A2. Do not merge it first.

After #76 releases:

1. fetch/reconcile the actual PR #77 head onto released main
2. run fresh exact-candidate validation
3. re-read migration history and apply only reviewed absent Phase 10A3 migrations
4. configure the independent server-only webhook secret/endpoint without exposing the secret
5. prove invalid-signature and oversize rejection before JSON processing
6. prove replay protection, installation/repository lifecycle handling, latest-head coalescing, same-head pending recovery, and stale-trigger authoritative-head recovery
7. prove public/private separation and leak boundaries
8. prove a complete automatic webhook-triggered immutable-snapshot scan through findings
9. merge/release only after all operational checks pass
10. verify production

## 4. Hosted runtime gates

Keep these false/absent until the exact capability has its own staged operational and rollback acceptance:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

`HOSTED_GITHUB_INTEGRATION_ENABLED` is separate. Its positive provider canary was already proven. Re-read live provider state before changing it.

Code presence, a successful build, schema presence, or historical containment evidence does not by itself authorize a runtime gate.

## 5. Safe independent work while #79 is blocked

Do not sit idle if #79 cannot be completed safely. Continue only work that cannot bypass or weaken the provider gate, for example:

- documentation/handoff repair
- dependency/runtime/tooling maintenance
- TDD regression strengthening
- architecture/security review
- evidence-based UI defect fixes
- release/branch hygiene

Keep such work isolated. Do not use an unrelated green PR as evidence that provider, Phase 10A2, Phase 10A3, or worker operational acceptance passed.

## 6. Branch cleanup

`docs/development/BRANCH_CLEANUP_CANDIDATES.md` records the previous full audit. The prior audit classified many historical refs as safe-delete candidates, while retaining `main`, the live Phase 10 PR heads, and intentional demo state.

Before deleting anything:

- re-fetch the complete current branch list
- classify every branch created since the old audit
- preserve any branch backing an open PR or active task
- use a real delete-ref operation only
- never simulate branch deletion by force-moving a ref
- re-list refs afterward and update the cleanup record

## 7. External account synchronization

Read `docs/development/ACCOUNT_CONTEXT_CHECKLIST.md` before using external providers.

Known correct non-secret identifiers at handoff time:

- GitHub repository owner: `LeDoNguyenTu`
- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- **not ScopeForge:** Brian Job Command Center Supabase `xwsergbpvkcsugexssmc`
- Vercel team: `itsbrian` / `team_WEcf1g1YcD6vYU8LD5jVUOKF`
- Vercel project: `scopeforge` / `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`
- production domain: `scopeforge.dev`
- Cloudflare should be authoritative DNS, with Vercel app records DNS-only under the documented architecture
- Cloudflare Turnstile and private R2 are separate provider resources that must be verified in the correct Cloudflare account before writes
- historical worker acceptance used Oracle Cloud in Singapore; verify tenancy/compartment/host before any new host mutation

A context mismatch is a stop condition for external writes. Do not use a secret value as proof of account identity and do not paste secrets into Codex.

## 8. Validation and evidence discipline

For executable changes, prefer this progression:

1. focused regression test or reproducer
2. focused affected test group
3. `npm test`
4. `npm run typecheck`
5. relevant CLI/build/benchmark checks
6. `npm run build`
7. browser/security acceptance if affected
8. exact candidate CI and production verification when releasing

Use the repository's current scripts and workflow as the source of truth. Do not copy a stale command list if package scripts have changed.

For documentation-only changes, run affected guards/tests where available. `[skip ci]` may be used only when repository policy and the change type genuinely allow it. Never use `[skip ci]` to conceal an executable change from validation.

## 9. Documentation persistence rule

When a task changes meaningful project state, update the appropriate persistent files before ending the session:

- `CURRENT_STATE.md` for released/current truth
- `NEXT_STEPS.md` for ordered continuation
- `SESSION_HANDOFF.md` for fastest resume context
- `UNFINISHED_WORK.md` for genuinely pending work
- this file only when the Codex-specific synchronization or account handoff process changes

Do not churn every embedded SHA after a docs-only merge. Preserve immutable evidence separately from the instruction to fetch live refs.

## 10. Copy-paste prompt for Codex

Use the prompt below when starting a fresh Codex session. Codex must still read the repository files instead of treating the prompt as a replacement for them.

```text
Continue my ScopeForge project autonomously from the actual current repository state.

Repository:
https://github.com/LeDoNguyenTu/ScopeForge

You have not been the primary implementation agent for a while, so your first task is reconciliation, not coding from remembered context.

MANDATORY STARTUP

1. Open the current ScopeForge checkout and read the root AGENTS.md.
2. Verify the remote is LeDoNguyenTu/ScopeForge.
3. Run git status, fetch all remotes with prune, resolve live origin/main, inspect the current branch/worktree, and inspect all open PRs/issues and their exact current heads/checks.
4. Read these files in order:
   - docs/development/CODEX_HANDOFF.md
   - docs/development/ACCOUNT_CONTEXT_CHECKLIST.md
   - docs/development/CURRENT_STATE.md
   - docs/development/NEXT_STEPS.md
   - docs/development/SESSION_HANDOFF.md
   - docs/development/UNFINISHED_WORK.md
5. Compare those documents to live GitHub state. Live state wins. Do not blindly resume from any historical SHA or branch name embedded in a document.
6. Before any external provider write, verify the non-secret target identity against ACCOUNT_CONTEXT_CHECKLIST.md. In particular, ScopeForge Supabase is tdgpibrepzcvdivztkta and must never be confused with Brian Job Command Center xwsergbpvkcsugexssmc.

CURRENT HANDOFF PRIORITIES

At the time the handoff was prepared, main was ec7b00d1f533704100e224bc53f6a6647a3e1a4b, but you MUST fetch the current main before acting.

First reconcile every currently open maintenance PR. In particular, PR #97 was in its intentional RED TDD phase: its new public-CI action-pinning guard failed because docs/scanner/CI.md still used movable @vN GitHub Action tags. Re-read the live PR and main, reconcile it onto current main, complete the minimal GREEN change using verified immutable official action commits, run validation, and merge/close/supersede it only according to current evidence.

Then continue the primary unfinished queue from live state:
- issue #79 remaining GitHub App negative production authorization canaries
- Phase 10A2 PR #76 private repository acquisition, only after #79 clears
- Phase 10A3 PR #77 webhook reconciliation, only after Phase 10A2 releases

Do not repeat work already marked complete just because you see an old branch or plan. Phase 6D Task 15 real Linux/rootless-Podman acceptance is complete. Positive GitHub App owner/admin connection/import acceptance is also complete.

SECURITY AND RELEASE RULES

- Never expose or commit secrets, provider private keys, OAuth/install tokens, Supabase secret/service-role keys, R2 keys, worker credentials, presigned private URLs, or environment dumps.
- Never rewrite deployed Supabase migrations. Use forward-only migrations.
- Preserve RLS, provider authorization, strict nonce CSP, security headers, zero-egress/containment boundaries, responsive UI acceptance, and the accepted Command Center presentation.
- Keep hosted repository/private scan and active/passive runtime flags false/absent until their own operational acceptance and rollback gates pass.
- Do not weaken authorization or fabricate production state to force a canary through.
- Use exact-SHA/evidence-based validation before claiming a release is green.
- Use TDD for fixes/features where appropriate.
- Do not add AI co-author attribution.
- Do not force-push, delete branches, change DNS, rotate credentials, apply production migrations, enable gated production capabilities, or mutate production identities merely to unblock yourself. Perform high-impact operations only when they are the required reviewed step of the current approved release task and the target account is proven correct.

ACCOUNT TARGETS TO VERIFY

- GitHub repo: LeDoNguyenTu/ScopeForge
- GitHub identity expected for owner work: LeDoNguyenTu
- Supabase ScopeForge: tdgpibrepzcvdivztkta
- Wrong/different Supabase: xwsergbpvkcsugexssmc (Brian Job Command Center)
- Vercel team: itsbrian, team_WEcf1g1YcD6vYU8LD5jVUOKF
- Vercel project: scopeforge, prj_r7X4rdsjvwzp2tvuSA4D39gpITb8
- domain: scopeforge.dev
- Cloudflare: verify the account containing the scopeforge.dev DNS zone, ScopeForge Turnstile resource, and the R2 account/bucket matching production configuration before any write
- Oracle Cloud: verify tenancy/compartment/region/host before any host-level worker operation

AUTONOMY

Handle normal engineering decisions yourself. You are authorized to inspect code/history, create scoped branches, edit code/docs/tests, commit, push, create/update PRs, review failures, and merge changes when the exact candidate is genuinely safe and validated. Do not stop after one small safe task if the next independent task is actionable.

If the release queue is blocked by a browser/account condition you cannot safely satisfy, document the exact blocker and continue other independent safe work. Do not bypass the gate.

Before finishing a session, update the persistent handoff/state docs for any meaningful state change and leave the repository in a clean, explainable state with exact branch/PR/check evidence.
```
