# ScopeForge Unfinished Work

Last reconciled: 2026-09-18, Asia/Singapore.

## PR #128 release remainder

Task 9 implementation and hardening are present on `feat/phase-11a-run-orchestration-20260918`.

Remaining before merge:

- exact-head full CI
- exact-head Vercel
- final mergeability/review-thread check
- final changed-file review
- merge only after those gates pass
- verify released main after merge

Do not:

- apply either Phase 11 migration to production
- enable external Phase 11 provider execution
- bypass the separate schema/provider operational gates

## Validation already completed

- CI #1150: 446 test files and 2,035 tests passed; four test-only type errors were the only failure
- test typing errors fixed
- CI #1151: complete pipeline passed on earlier release-candidate head
- later hardening added replay identity, capability-version identity, stable SHA-256 identifiers, and explicit queue idempotency, so #1151 is not the final exact-head gate

## Next implementation after Task 9

Follow the approved Phase 11 plan.

Preferred sequence:

1. release trusted run orchestration
2. build the adaptive end-to-end evaluation harness
3. perform provider license/containment/execution-boundary review
4. add external provider slices only after that review
5. keep production schema/provider enablement separately gated

## Completed and not to repeat

- Phase 10A2 private repository scanning
- Phase 10A3 GitHub webhook reconciliation
- Phase 11 Tasks 1 to 7
- Phase 11 Task 8 persistence implementation and source validation
