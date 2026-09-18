# ScopeForge Codex handoff

Last reconciled: 2026-09-18, Asia/Singapore. Live GitHub/provider state wins if it differs from this file.

## Current resume point

- Repository: `LeDoNguyenTu/ScopeForge`
- Released `main`: `1e5e40d7809ec34b414877559025b70e53933fdd`
- Active branch: `feat/phase-11a-planning-persistence-20260918`
- Active PR: #127, Phase 11A planning persistence foundation
- PR #125 is merged and released. It completed Phase 11 Tasks 1 to 7.
- PRs #76 and #77 plus Phase 10A2/10A3 release work are complete. Do not repeat those acceptance exercises.

## Task 8 state

PR #127 implements the Phase 11A persistence boundary:

- `supabase/migrations/20260918063000_phase_11a_planning_persistence.sql`
- `lib/database.phase11.types.ts`
- `lib/pentest-graph/persistence.ts`
- `lib/pentest-observations/persistence.ts`
- focused persistence contract and mapping tests

Security model:

- RLS is enabled on every Phase 11 table.
- Browser/application roles have no canonical INSERT/UPDATE/DELETE authority.
- Workspace members may SELECT only the explicit privacy-reduced read set.
- Authorization snapshots, actions/attempts, approvals, and run events are trusted-only.
- Trusted mutation RPCs are `SECURITY DEFINER`, use `set search_path = ''`, and are executable only by the trusted server role.
- Every graph/observation/hypothesis/coverage/run-event mutation is rebound to an existing workspace/run and a non-expired authorization snapshot.
- Provider secrets, raw provider traffic, arbitrary command material, and model context are excluded from the schema.

TDD evidence:

- CI #1148 is the deliberate RED checkpoint from the test-only commit.
- It failed only the six new Task 8 contract assertions because the implementation did not yet exist.
- The 443 pre-existing test files and 2,022 pre-existing tests passed in that run.

## Provider/account state

- GitHub login: `LeDoNguyenTu`
- Correct Supabase project: `tdgpibrepzcvdivztkta` named `ScopeForge`
- Wrong project for this repo: `xwsergbpvkcsugexssmc` named `Brian Job Command Center`
- ScopeForge Supabase is ACTIVE_HEALTHY in `ap-southeast-1`.
- Its applied migration ledger still ends at the Phase 10A3 reconciliation/retention migrations.
- The Phase 11A migration in PR #127 has NOT been applied to production.
- No Phase 11 execution capability has been enabled.

## Required next actions

1. Obtain exact-head full CI and Vercel success for PR #127.
2. Review the final diff, PR state, and unresolved review threads.
3. Merge #127 only if those gates are green.
4. Verify released `main` after merge.
5. Continue Task 9 run orchestration from `docs/superpowers/plans/2026-09-17-phase-11-autonomous-security-validation.md`.
6. Do not apply Phase 11 production schema or enable new runtime authority until the separate schema/operational review says to do so.

## Tooling caveat

`AGENTS.md` requires GitNexus impact and change-detection checks. GitNexus MCP is not exposed in this ChatGPT connector session, so no GitNexus report can truthfully be claimed for Task 8. This slice was intentionally structured around new source files rather than edits to existing application symbols. A later agent with GitNexus available should run the required change-detection review before release if possible.

Never expose secrets, weaken authorization/RLS/containment, fabricate provider state, rewrite already-deployed migrations, or confuse the ScopeForge Supabase project with the Job Command Center project.
