# ScopeForge Next Steps

## Current phase: Phase 2 - Asset Control

Execute the active plan in `docs/superpowers/plans/2026-08-24-phase-2-asset-control.md` in this order:

1. Complete community positioning and resumable project-state documentation.
2. Add the Vitest and React Testing Library harness.
3. Add the Phase 2 Supabase schema, indexes, and RLS policies.
4. Implement canonical target normalization and private-target rejection.
5. Implement verification challenge primitives and bounded HTTP verification.
6. Add quota logic and append-only audit events.
7. Build asset registration, inventory, detail, and verification UX.
8. Replace dashboard placeholder counts with live workspace data.
9. Run unit tests, typecheck, production build, Supabase security advisor, and performance advisor.
10. Update `SESSION_HANDOFF.md`, `TEST_STATUS.md`, and `IMPLEMENTATION_LOG.md` before merging.

## Phase boundary

Do not begin active scanning in Phase 2. The next phase begins only after asset authorization, quotas, auditability, and control-plane safety are validated.
