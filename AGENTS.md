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

Phase 10A2 and Phase 10A3 are released and GitHub App issue #79 is closed. The current release-critical boundary is the final Phase 11 operational canary documented in `docs/development/CODEX_HANDOFF_PHASE11.md`, `CURRENT_STATE.md`, and `NEXT_STEPS.md`.

Do not enable external Nmap, Nuclei, httpx, broad exploit frameworks, or deferred advanced providers merely to move a completion percentage. Resolve live `main`, open PRs, provider state, and the exact remaining Phase 11 gate before acting.

## External account context

Known non-secret production identifiers are documented in `docs/development/ACCOUNT_CONTEXT_CHECKLIST.md`. If a connected account shows a different project, team, zone, repository owner, or provider identity, stop before making external changes and resolve the mismatch. Never use secret values as identity evidence.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **ScopeForge** (17200 symbols, 28316 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/ScopeForge/context` | Codebase overview, check index freshness |
| `gitnexus://repo/ScopeForge/clusters` | All functional areas |
| `gitnexus://repo/ScopeForge/processes` | All execution flows |
| `gitnexus://repo/ScopeForge/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
