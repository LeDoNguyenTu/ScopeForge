# ScopeForge phone-session handoff

Checkpoint: 2026-09-15, Asia/Singapore. Re-fetch live state before acting.

## Start a new ChatGPT session

Paste this prompt, together with this file's GitHub link:

```text
Continue ScopeForge from the linked PHONE_SESSION_HANDOFF.md. Read root AGENTS.md and the six startup documents in its prescribed order, then reconcile live GitHub state. Repository: LeDoNguyenTu/ScopeForge; expected GitHub account: LeDoNguyenTu. Use Node 24.

At the checkpoint, PR #109's compatible dependency refresh was fully validated but a normal merge was rejected by the main-branch policy. Do not use --admin, change rules, or treat the PR as released. Inspect the live restriction and use an authorized release path only.

Issue #79 still requires two real authenticated production negative canaries: reject an unrelated valid installation ID in the normal owner/admin callback flow, and reject Connect GitHub for a legitimate member/viewer. Do not fabricate auth/database state or downgrade an owner. After #79 passes, follow PR #76 then PR #77 with their separate schema/runtime/privacy/rollback acceptance. Keep unaccepted hosted runtime capabilities off.

Continue independent scoped engineering work where actionable. Keep a durable checkpoint after meaningful progress and before switching sessions. Record exact branch/SHA, local or published edits, validation, blockers, and next steps. Never include secrets. If this phone session lacks repository/provider tools, say which actions cannot be performed rather than claiming they ran.
```

## Verified repository state

- Remote: `https://github.com/LeDoNguyenTu/ScopeForge.git`; authenticated CLI account: `LeDoNguyenTu`.
- Fetched/pruned main: `5cd055b0575e41450844f81425956716d2d3f37c`.
- Startup checkout was clean on `chore/refresh-compatible-dependencies`, head `74152ca469b75d5ccacc42db713d34b04ab2d4bd`.
- [PR #109](https://github.com/LeDoNguyenTu/ScopeForge/pull/109) remains open. Its existing implementation changes only `package-lock.json`: compatible Supabase, React, Testing Library and type-package versions, plus root Node engine metadata. No new executable changes were made in this session.
- [PR #76](https://github.com/LeDoNguyenTu/ScopeForge/pull/76) remains draft at `709ef8af4ce4befae12ba910d3bca15599b5cab1`.
- [PR #77](https://github.com/LeDoNguyenTu/ScopeForge/pull/77) remains draft at `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`.
- [Issue #79](https://github.com/LeDoNguyenTu/ScopeForge/issues/79) is the only open issue at this checkpoint.
- This handoff is prepared on `docs/mobile-session-handoff-20260915`, based on main. Preserve it and the dependency branch alongside main, both Phase 10 branches and the intentional demo branch. Earlier four-remote-branch counts are historical.

## PR #109 evidence and release blocker

Directly re-read [CI run 34876465231](https://github.com/LeDoNguyenTu/ScopeForge/actions/runs/34876465231) for exact head `74152ca469b75d5ccacc42db713d34b04ab2d4bd`:

- 398 test files and 1,748 tests passed; audit reported zero vulnerabilities.
- Typecheck, CommonJS CLI build/version, scanner benchmark, benchmark matrix and Next production build passed.
- CSP browser smoke, production UI/Turnstile diagnostic and screenshot upload steps passed. The production diagnostic is separate from deployment of this candidate; it does not prove #109 is in production.
- Vercel's GitHub check reports preview success. No authenticated preview or production browser session was inspected in this session.
- No PR reviews or inline review comments were present. `npm ls --depth=0` and the candidate diff check passed locally on Node 24.16.0. The full suite was not rerun locally; the exact-candidate Linux CI evidence above was inspected directly.

GitHub reports `mergeStateStatus: BLOCKED`. Active ruleset `22034913`, "Prevent unauthorized push", applies creation/update/deletion/non-fast-forward restrictions to the default branch. The ordinary SHA-guarded merge command failed:

```text
gh pr merge 109 --repo LeDoNguyenTu/ScopeForge --merge --match-head-commit 74152ca469b75d5ccacc42db713d34b04ab2d4bd
Pull request ... is not mergeable: the base branch policy prohibits the merge.
```

No administrator override, ruleset change, auto-merge enrollment or release occurred. This was GitHub's repository policy rejection, not an automatic tool-approval rejection. An authorized maintainer must resolve the release path; a green check is not permission to bypass this rule. Recheck head/base/checks before any later merge and verify post-merge CI and production separately.

## Remaining provider work

The positive owner/admin connection and import canary is already complete according to the live issue. Do not repeat it as unfinished work.

Both negative checks remain unproven. Historical documents record owner confirmation and installed-App settings routing difficulties, plus no member/viewer session. Browser authentication and current membership state were not re-read in this session. Establish legitimate sessions and the normal signed callback before testing; missing-state rejection alone is not installation-authorization evidence.

Phase 10A2/10A3 migrations, provider credentials, flags, production identities, webhook configuration and worker hosts were not changed or freshly inspected here. Production schema/flag observations in older handoffs remain historical. ScopeForge Supabase is `tdgpibrepzcvdivztkta`; never use `xwsergbpvkcsugexssmc`.

## Persistence and next actions

1. Open this handoff on its documentation branch if it is not yet merged. A new phone chat cannot see unpublished local files or inherit authenticated desktop sessions automatically.
2. Inspect all live PRs, #79, main, checks and rules before continuing. Preserve active branches and local edits.
3. Resolve #109 through an authorized release path, then verify exact post-merge CI and deployment. Do not bypass the current policy.
4. Complete #79 when legitimate browser identities/flow are available; only then proceed through #76 and #77 acceptance in order.
5. Refresh this checkpoint after meaningful progress. The assistant cannot see the account's remaining usage quota, so save proactively rather than waiting for a limit warning.

The four state/queue handoffs and CODEX_HANDOFF.md point here. Documentation validation is whitespace/diff and relative-link verification; no executable behavior changed.
