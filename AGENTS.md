# ScopeForge agent instructions

This repository is security-sensitive. Any coding agent, including Codex, must synchronize against live repository and provider state before changing anything.

## Start here

Before implementation work:

1. Confirm the repository is `LeDoNguyenTu/ScopeForge` and the GitHub identity is the intended project owner or an explicitly authorized account.
2. Fetch and prune remote refs. Do not trust a SHA copied from an old conversation or handoff as the current branch tip.
3. Inspect live `main`, all open pull requests, open release-blocking issues, current CI state, and the working tree before choosing a task.
4. Read these files in order:
   - `docs/development/CODEX_HANDOFF.md`
   - `docs/development/ACCOUNT_CONTEXT_CHECKLIST.md`
   - `docs/development/CURRENT_STATE.md`
   - `docs/development/NEXT_STEPS.md`
   - `docs/development/SESSION_HANDOFF.md`
   - `docs/development/UNFINISHED_WORK.md`
5. Reconcile any difference between those documents and live GitHub/provider state. Live evidence wins. Update the persistent handoff documents when semantic state changes.

## Hard safety rules

- Never commit, print, paste, or log secret values, private keys, OAuth tokens, installation tokens, R2 credentials, worker credentials, presigned private artifact URLs, Supabase secret keys, or full environment dumps.
- Never confuse the ScopeForge Supabase project `tdgpibrepzcvdivztkta` with the separate Brian Job Command Center project `xwsergbpvkcsugexssmc`.
- Never rewrite an already deployed Supabase migration. Corrections are forward-only migrations.
- Keep hosted runtime capabilities default-off until their own operational acceptance and rollback evidence exists.
- Do not weaken authorization, RLS, provider identity checks, zero-egress boundaries, CSP, or containment controls to make a test pass.
- Provider credentials remain control-plane-only. Private repository source and capability material must not leak into browser state, ordinary logs, issue comments, PR comments, worker payloads, or chat.
- Preserve the accepted Command Center UI, responsive admin/GitHub UI, strict nonce CSP, security headers, mobile no-horizontal-page-scroll behavior, safe-area behavior, and authorization boundaries unless a concrete defect requires a scoped change.
- Use Node 24 for the current repository runtime contract unless live repository configuration has intentionally changed.
- Use TDD for fixes/features where practical: reproduce or add the failing guard first, make the smallest safe change, then run focused and full validation appropriate to the change.
- Do not claim CI, schema, provider, runtime, or production success without direct evidence for the exact candidate being discussed.
- Do not add AI co-author attribution to commits.
- Do not force-push, delete branches, rewrite history, apply production migrations, enable capability flags, rotate credentials, or mutate production identities merely to unblock work unless the action is explicitly justified, reviewed, and safe.

## Release ordering

At the time this instruction file was introduced, GitHub App issue #79 remained the operational gate before Phase 10A2 PR #76, and Phase 10A3 PR #77 must follow the released Phase 10A2 work. Do not rely on that sentence alone. Re-read the live issue and pull requests first because they may have advanced.

## External account context

Known non-secret production identifiers are documented in `docs/development/ACCOUNT_CONTEXT_CHECKLIST.md`. If a connected account shows a different project, team, zone, repository owner, or provider identity, stop before making external changes and resolve the mismatch. Never use secret values as identity evidence.