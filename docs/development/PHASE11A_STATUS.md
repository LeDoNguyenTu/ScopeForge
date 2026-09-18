# Phase 11A Status

Last reconciled: 2026-09-18, Asia/Singapore. Live provider state wins if newer.

## Released baseline

- Released `main`: `e4af4d707a7a6139ad12a705e4c3b5ece726d3e0`.
- PR #125 released Phase 11 Tasks 1 to 7.
- PR #126 released Task 8 planning persistence.
- Task 8 source head passed CI #1146 and Vercel.
- No Phase 11 migration has been applied to production.
- No Phase 11 external provider execution capability is enabled.

## Active Task 9

- PR: #128, `Phase 11A trusted pentest run orchestration`.
- Branch: `feat/phase-11a-run-orchestration-20260918`.
- Base migration: `supabase/migrations/20260918070000_phase_11a_run_orchestration.sql`, source-only and unapplied.
- Hardening migration: `supabase/migrations/20260918070100_phase_11a_run_orchestration_hardening.sql`, source-only and unapplied.

Task 9 adds:

- verified-asset owner/admin run creation
- immutable authorization and run-policy snapshots
- trusted planning-state loading
- deterministic planner -> policy -> approved-action enqueue orchestration
- exact enqueue reservation tokens and explicit queue idempotency keys
- owner/admin intrusive and validation approval workflow
- cancellation propagation through an injected queue boundary
- privacy-reduced run/action read models
- private authorization, action, attempt, and approval state
- service-role-only `SECURITY DEFINER` orchestration RPCs with `search_path = ''`
- an architecture guard that keeps provider, process, network, service-role-key, and worker-credential authority outside `lib/pentest-runs`

## Review hardening completed

Task 9 review found and fixed four important lifecycle/identity defects:

1. Intrusive actions without approval previously became permanently `rejected`. They now enter `approval_required`, allowing the same deterministic action to resume after a fresh owner/admin approval.
2. Run creation replay previously compared too little immutable authority. Replays now bind the stored authorization node set, execution-mode ceiling, authorization expiry, creator, policy snapshot, deadline, workspace, asset, and snapshot reference.
3. Action persistence previously bound only capability ID. Actions and authorizations now also bind capability version, so approval cannot silently resume against a same-ID capability upgrade.
4. Cancellation could race the gap between external enqueue and queue-reference finalization. Cancellation-aware finalization now preserves only the enqueue reservation needed to reconcile that queue reference, persists a late queue reference without reviving the action, and immediately cancels the external queue item. Late stop calls also cannot overwrite an already terminal public run summary.

Phase 11 identifiers are now fixed-size deterministic SHA-256 identifiers:

- action: `phase11-action:<64 hex>`
- authorization / queue idempotency: `phase11-authz:<64 hex>`
- cancellation: `phase11-cancel:<64 hex>`

The stable identifier input is canonical bounded planning material, and the queue boundary receives the version-bound authorization ID as its idempotency key.

## Validation history

- CI #1150: all 446 test files and 2,035 tests passed; only four test-only TypeScript errors failed the run.
- Those four typing errors were fixed.
- CI #1151 on the earlier release-candidate head `fda54dbf...` passed the complete pipeline.
- #1151 is no longer the exact-head release gate because the replay, capability-version, and bounded-identifier hardening landed afterward.
- CI #1152 then passed the complete pipeline on `fe6f8794...`; the cancellation-race hardening landed afterward, so one final exact-head gate is still required.
- New tests cover approval, replay identity, capability-version identity, stable IDs, queue idempotency, cancellation propagation, migration authority, and control-plane execution boundaries.

GitNexus is required by repository guidance but is not exposed in this ChatGPT connector session. Do not claim a GitNexus result for this continuation.

## Release gate

Before merging PR #128:

1. require exact-head full CI success
2. require exact-head Vercel success
3. confirm PR remains mergeable and review threads are clear
4. keep both Phase 11 migrations unapplied to production
5. keep all external Phase 11 provider execution disabled

After Task 9 releases, continue the adaptive end-to-end evaluation harness before external provider expansion, following the approved Phase 11 implementation order.
