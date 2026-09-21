# Historical documentation guide

Last reconciled: 2026-09-22, Asia/Singapore.

ScopeForge intentionally retains detailed acceptance, incident, migration, and phase working-state records. Those files are evidence, not current execution instructions.

## Current resume documents

Agents should use these first:

1. `AGENTS.md`
2. `docs/development/PHASE11_SINGLE_CODEX_RUN.md` for the final Phase 11 closure
3. `docs/development/CODEX_HANDOFF.md`
4. `docs/development/CURRENT_STATE.md`
5. `docs/development/NEXT_STEPS.md`
6. `docs/development/UNFINISHED_WORK.md`

Live GitHub, Supabase, Vercel, and worker state wins over documentation.

## Historical records

Files whose names include terms such as:

- `ACCEPTANCE`
- `WORKING_STATE`
- dated `AUTOMATION_RECONCILIATION`
- old phase-specific handoffs
- superpowers plans/specs

may correctly contain statements that were true at the time but are no longer current. Examples include issue #79 as a Phase 10 gate, PR #76/#77 ordering, or earlier Phase 11 task checkpoints.

Do not rewrite those historical claims merely to make them read like the present. Preserve their evidentiary value.

When a historical file contains an explicit "resume rule" that sends agents to a closed gate, prefer the current resume documents above.

## Cleanup rule

Documentation cleanup should remove ambiguity from **active guidance**, not erase historical evidence.

If an agent discovers a stale statement in a file that is clearly an acceptance record or dated reconciliation:

1. do not infer current release state from it
2. check the current resume documents and live providers
3. add or improve a historical marker/index only if agents are likely to mistake it for active guidance
4. avoid broad wording rewrites that alter the original acceptance record
