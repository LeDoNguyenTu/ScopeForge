# Phase 11A Planning Status

Last updated: 2026-09-18, Asia/Singapore.

## Live baseline

- Released `main`: `1e5e40d7809ec34b414877559025b70e53933fdd`, the merge of PR #125.
- PR #125 released Phase 11 Tasks 1 to 7: domain contracts, graph, hypotheses/coverage, deterministic policy, capability registry, native observation adapters, and planner v1.
- Active Task 8 PR: #127 on `feat/phase-11a-planning-persistence-20260918`.
- Correct Supabase project: `tdgpibrepzcvdivztkta` (`ScopeForge`). The separate Job Command Center project must not be used.
- The live Supabase migration ledger still ends at Phase 10A3. The Phase 11A migration in PR #127 is source-only and has not been applied.
- No Phase 11 hosted execution class or runtime capability has been enabled.

## Task 8 implementation in PR #127

Task 8 adds the persistence boundary required before run orchestration:

- forward-only migration `20260918063000_phase_11a_planning_persistence.sql`
- typed `Phase11Database` overlay
- normalized tables for runs, authorization snapshots, graph nodes/edges, observations, hypotheses, actions/attempts, coverage, approvals, and run events
- RLS on every new public table
- browser roles receive SELECT only on the explicit workspace-member read set and no canonical DML authority
- authorization snapshots, actions/attempts, approvals, and run events remain trusted-only
- service-role-only `SECURITY DEFINER` mutation RPCs pin `search_path = ''`
- every Task 8 mutation revalidates workspace, run, and a fresh authorization snapshot
- graph edge and observation writes validate their referenced graph nodes against the same run/snapshot
- raw request/response bodies, credentials, provider-native args, shell commands, and model context are not persisted
- graph and observation application repositories call typed narrow RPCs only and do not perform direct table DML

## TDD evidence

- The Task 8 persistence contract was committed before implementation.
- CI run #1148 failed exactly as expected with 6 failures in `tests/pentest/phase11-persistence.test.ts` because the migration, database overlay, and repositories did not yet exist.
- All 443 pre-existing test files passed in that RED run, with 2,022 existing tests green.
- Focused graph/observation mapping tests were then added with the implementation.

GitNexus MCP is required by `AGENTS.md`, but no GitNexus tool is exposed in this ChatGPT connector session. Task 8 therefore avoids modifying existing application/source symbols; only new implementation files and durable documentation are changed. Do not claim a GitNexus report exists for this slice.

## Release gate

Before merge:

1. require exact-head full CI
2. require exact-head Vercel success
3. review the final diff and unresolved PR threads
4. keep the Phase 11 migration unapplied in production
5. keep all new hosted execution capabilities disabled

After Task 8 merges, continue with Task 9 run orchestration from the Phase 11 implementation plan. Production schema rollout remains a separate reviewed gate.
