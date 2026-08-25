# ScopeForge Next Steps

## Phase 5C completion boundary

Phase 5C Hosted Phase 3 finding import is implemented on PR #37 and its additive production database schema is reconciled.

Delivered capabilities:

- versioned privacy-reduced `hosted-json` local/CI export
- canonical public GitHub repository binding
- closed scanner/rule/version registry
- strict canonical envelope and path validation
- 3.5 MB streamed request cap
- maximum 500 findings / 500 evidence rows
- repository-bound terminal `phase3_import` scan provenance
- immutable RLS-protected import-run history
- service-role-only atomic persistence RPC
- idempotent exact retry and fail-closed conflict handling
- canonical finding/evidence/occurrence/event reuse
- no absence-based static `verified_fixed`
- repository-only import UX with bounded history
- stable 100-row finding pagination
- dependency guards against hosted repository execution, runtime networking, shell/process/VM/worker authority, package-manager execution, and model-provider authority
- additional secret privacy hardening that removes local secret-derived fingerprints and regenerates secret evidence summaries from reviewed rule metadata

Production Supabase contains:

- `20260825210845 phase_5c_phase3_import_enum`
- `20260825211003 phase_5c_phase3_import`
- `20260825211239 phase_5c_phase3_import_fk_indexes`

Security advisor is clean and all Phase 5C foreign keys have covering indexes.

## Verification constraint

GitHub Actions monthly allowance was exhausted during PR #37. The user explicitly requested no further GitHub Actions use for the remainder of the month. Do not trigger or rerun Actions.

Final Phase 5C verification must therefore remain explicit about its evidence:

- earlier pre-quota Phase 5C executable checkpoints
- targeted static/security diff review
- live Supabase migration/RLS/privilege/constraint/index verification
- clean Supabase security advisor
- no Phase 5C missing-FK-index advisor notices
- live-generated Supabase type contract comparison
- local compiler/static checks available in the current execution environment
- no blocking PR review threads

Do not claim exact-head GitHub CI green for PR #37.

## Next major boundary - Phase 6 isolated workers and scanner scale

Phase 6 is where hosted execution belongs. Phase 5C deliberately imports already-produced local/CI results and does not clone or execute repositories in the control plane.

Phase 6 should add queue-backed isolated workers while preserving all existing security invariants.

### Required Phase 6 architecture

- durable job queue and explicit job lifecycle
- worker leases with expiry/recovery
- bounded concurrency and backpressure per workspace/fleet
- CPU, memory, wall-clock, file-count, byte-count, and request budgets
- cancellation that wins before persistence when required
- isolated filesystem/workspace per job
- no package lifecycle-script execution by default
- private artifact storage with bounded retention and classification
- dedicated egress policy rather than control-plane networking
- DNS/IP policy reuse for any authorized remote target work
- structured logs/metrics without secret or source leakage
- abuse controls, quotas, rate limits, and operational kill switches
- deterministic provenance tying worker results to workspace, asset, job, scanner/profile versions, and immutable authorization snapshots

### Phase 6 must not widen these boundaries

- repository assets do not become runtime web/API targets
- browser callers cannot submit shell commands, clone flags, package-manager options, arbitrary headers/body, target URLs, or resource limits
- existing passive runtime authority remains separate from active validation authority
- new active validation profiles require their own explicit security design and authorization review
- model/advisory output cannot promote deterministic validation or lifecycle state
- worker isolation is not permission for unrestricted outbound networking

## Recommended implementation order

1. Define the worker/job threat model and immutable execution contract.
2. Define queue, lease, cancellation, retry, and idempotency semantics.
3. Build an isolated local worker adapter with no network authority first.
4. Move existing Phase 3 scanner execution behind that boundary without package execution.
5. Add private artifact handling and retention.
6. Add concurrency/backpressure/quotas and operational controls.
7. Only then design dedicated egress for authorized runtime/active work.
8. Add fleet observability and recovery procedures.

## Later roadmap

After Phase 6:

- Phase 7 Community Security Packs
- Phase 8 validation, benchmarks, vulnerable labs, and public methodology
- Phase 9 production hardening and public release

## Resume protocol

Before a new implementation session:

1. Read `docs/development/SESSION_HANDOFF.md`.
2. Read `docs/development/CURRENT_STATE.md`.
3. Read `docs/development/TEST_STATUS.md`.
4. Read `docs/ARCHITECTURE.md` and `docs/PHASES.md`.
5. Confirm PR #37 merge/reconciliation status.
6. Confirm the three Phase 5C production migrations remain present.
7. Preserve the canonical ledger, secret/privacy boundary, service-role-only mutation authority, and repository/runtime separation.
8. Start Phase 6 with a design/threat model before implementation.