# ScopeForge Current State

Last reconciled: 2026-09-18, Asia/Singapore.

## Released baseline

- `main`: `1e5e40d7809ec34b414877559025b70e53933fdd`
- PR #125: merged, releasing Phase 11 Tasks 1 to 7.
- Phase 10A2 and 10A3 are released and are not current blockers.
- No open release task should repeat PR #76/#77 production acceptance.

## Active work

- PR #127: Phase 11A Task 8 persistence foundation.
- Branch: `feat/phase-11a-planning-persistence-20260918`.
- The source migration is intentionally unapplied.
- No new hosted Phase 11 execution class is enabled.

Task 8 currently contains:

- Phase 11 persistence schema for runs, authorization snapshots, graph, observations, hypotheses, actions, attempts, coverage, approvals, and run events
- RLS and explicit table grants
- member-readable privacy-reduced tables only
- trusted-only lifecycle/authorization tables
- service-role-only mutation RPCs with pinned search path
- workspace/run/fresh-authorization rebinding for trusted mutations
- typed database overlay
- narrow graph and observation repositories
- focused security-contract and mapping tests

## Validation

- CI #1148 is the intentional RED checkpoint. It failed the six new persistence-contract assertions before implementation existed.
- The same run had 443 existing test files and 2,022 existing tests passing.
- Exact-head GREEN CI and Vercel are still required before #127 can merge.

## Supabase

- ScopeForge: `tdgpibrepzcvdivztkta`, ACTIVE_HEALTHY, `ap-southeast-1`.
- Production migration ledger still ends at Phase 10A3.
- Do not apply the Phase 11A migration as part of Task 8 code review.

## Next phase

After #127 merges, Task 9 is the next planned implementation slice: run creation/orchestration, policy-approved action lifecycle, cancellation, retries, append-oriented event history, and persisted/replayable run manifests. Runtime execution capabilities remain separately gated.
