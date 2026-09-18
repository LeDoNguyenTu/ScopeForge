# ScopeForge Current State

Last reconciled: 2026-09-18, Asia/Singapore.

## Released baseline

- `main`: `e4af4d707a7a6139ad12a705e4c3b5ece726d3e0`
- Phase 11 Tasks 1 to 7 released through PR #125.
- Phase 11 Task 8 persistence released through PR #126.
- No Phase 11 migration is applied to production.
- No external Phase 11 provider execution is enabled.

## Active work

- PR #128: Phase 11A trusted pentest run orchestration.
- Branch: `feat/phase-11a-run-orchestration-20260918`.
- Task 9 migration remains source-only.

Implemented control-plane behavior:

- verified-asset owner/admin run creation
- immutable authorization/policy snapshots
- planner -> policy -> enqueue control flow
- replay-safe enqueue reservations
- version-bound queue idempotency
- approval resume
- cancellation propagation
- privacy-reduced read models
- service-role-only trusted persistence

Review hardening:

- intrusive approval lifecycle fixed
- run replay fully bound to immutable authority
- action identity bound to capability version
- fixed-size SHA-256 action/auth/cancellation IDs added
- enqueue/cancel race closed with cancellation-aware queue-reference finalization
- late stop requests cannot overwrite terminal public run summaries

## Validation

- CI #1150 passed all 446 test files and 2,035 tests, then failed only four test typing errors.
- Those typing errors are fixed.
- CI #1151 passed the full pipeline on pre-hardening head `fda54dbf...`.
- CI #1152 passed the full pipeline on `fe6f8794...`.
- Cancellation-race hardening landed after #1152, so a new exact-head CI/Vercel run is required for the final branch.

## Supabase

- ScopeForge project: `tdgpibrepzcvdivztkta`.
- Phase 11 migrations remain unapplied.
- Production rollout is a separate reviewed gate.

## Next

Finish exact-head validation and review for #128. If green, merge and verify released main. Then continue the adaptive end-to-end evaluation harness before external provider expansion.
