# ScopeForge Unfinished Work

Last reconciled: 2026-09-18, Asia/Singapore.

## Release-blocking for PR #127

Phase 11A Task 8 implementation is present on `feat/phase-11a-planning-persistence-20260918`.

Remaining before merge:

- exact-head full CI must pass
- exact-head Vercel preview must be READY
- final PR diff and review threads must be clean
- do not apply the Phase 11A migration to production during this gate
- do not enable any new Phase 11 execution capability

The deliberate RED TDD checkpoint is CI #1148. It failed only the six new Task 8 contract assertions before the implementation existed.

## Next implementation after Task 8

Task 9 from the approved Phase 11 plan:

- run creation with immutable policy and authorization snapshots
- orchestration loop over graph, observations, hypotheses, planner, policy gate, and capability router
- action lifecycle persistence
- bounded retry/cancellation semantics
- append-oriented run events and deterministic replay manifest
- no direct planner execution authority

Production schema rollout remains separately reviewed. Do not assume merge of Task 8 authorizes database deployment.

## Non-blocking backlog

- later Phase 11 external-provider design and licensing reviews
- browser/authenticated testing architecture
- bounded exploit-validation worker design
- continuous validation and longitudinal confidence work
- existing account-level Supabase leaked-password-protection setting
- measured performance-advisor follow-up where still applicable

## Completed and not to repeat

Phase 10A2 private repository scanning, Phase 10A3 GitHub webhook reconciliation, private same-head recovery, PR #76/#77 acceptance, and Phase 11 Tasks 1 to 7 are complete.
