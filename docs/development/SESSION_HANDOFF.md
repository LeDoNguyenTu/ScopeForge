# ScopeForge Session Handoff

## Current phase

Phase 5B Remediation, Retest, and Security Story is complete in code, documentation, and production database reconciliation.

- Phase 5B application merge: PR #33 -> `eb35c2b23468addd817951486c60ac7d68710c9a`
- exact reviewed PR #33 head: `5c7b8c34432f8bb51731fe069178411a8005d023`
- exact-head CI: #685
- permanent Phase 5B documentation: PR #34 -> `fcd535c8ad0c9909d77d6500fbf0845907bad783`
- final post-merge handoff correction: PR #35 -> `9d47eb98f3f9346217905f9df308869d096a5313`
- current reconciliation-doc branch: `docs/phase-5b-production-reconciled`

The next product design boundary is **Phase 5C Hosted Phase 3 finding import**.

## Completed platform work

- Phase 1 foundation complete.
- Phase 2 asset control and authorization complete.
- Phase 3 code and supply-chain security merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.
- Phase 4A security-domain contracts merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.
- Phase 4B passive runtime observations merged through PR #25 as `6879ff95f88be5cdb0eb0d7a94ef6ce56df0aa63`.
- Phase 4C-1 bounded CORS validation merged through PR #27 as `fb3aa27fac898cf20c87b57c86d6e8b2492fedd0`.
- Phase 5A hosted finding foundation delivered through PR #30.
- Phase 5B remediation, deterministic retest, and Security Story merged through PR #33 and is now deployed to production Supabase.

## Phase 5B production state

The hosted ScopeForge Supabase project is healthy and now includes both reviewed Phase 5B migrations:

- `20260825170915 phase_5b_remediation_retest_security_story`
- `20260825170933 phase_5b_retest_recovery_hardening`

The deployment-time versions differ from repository filenames because the Supabase migration API records its own application timestamp. The SQL contents deployed were reconstructed from the reviewed repository migration files in exact bounded chunks.

Post-deployment checks confirmed:

- `security_finding_work` exists and has RLS enabled
- `security_finding_retests` exists and has RLS enabled
- authenticated has SELECT only on both workflow tables
- authenticated has no INSERT/UPDATE/DELETE on either workflow table
- anon has no table access
- all five public Phase 5B mutation RPCs are `SECURITY DEFINER`
- all five public mutation RPCs use `search_path = ''`
- `public`, `anon`, and `authenticated` cannot execute those RPCs
- `service_role` can execute those RPCs
- execution/source/timestamp retest constraints are present
- immutable-snapshot and unverified-retest recovery triggers are present
- the four Phase 5A foreign-key covering indexes are present
- read-only smoke queries succeed on both new workflow tables
- security advisor is clean
- the prior missing-foreign-key-index notices are gone
- remaining performance notices are INFO-level unused indexes expected on a low-traffic/new database

Phase 5B is production-ready at the database boundary.

## Phase 5B implementation boundary

### Remediation work

`security_finding_work` stores assignment and bounded remediation notes beside the canonical `security_findings` record. Owner/admin may assign workspace members, members may self-assign, viewers are read-only, and trusted mutation paths independently enforce membership and role.

### Deterministic retest

`security_finding_retests` stores immutable retest snapshots. Only the existing passive runtime observer and `cors-origin-policy@1` active validator can be reused. Active retests require owner/admin plus explicit consent. No generic request authority was added.

A supported resolved finding can transition to `retest_pending`. Exact job/workspace/asset/requester/source/profile binding is required before execution is attached. Finalization derives its result from authoritative database state.

`verified_fixed` requires a fresh successful exact-source/profile retest with no target occurrence for the exact job and canonical lifecycle still pending. Failed, blocked, cancelled, stale, mismatched, or still-present retests cannot verify a fix. Non-verified terminal retests recover a still-pending finding to `in_progress`.

### Security Story v1

Security Story v1 is a deterministic bounded read model over canonical finding/evidence/history, remediation work, and retest state. It has no model-provider, network, or mutation authority.

## Verification state

CI #685 passed on exact PR #33 head `5c7b8c34432f8bb51731fe069178411a8005d023`:

- reproducible dependency install
- 148 test files / 654 tests
- strict TypeScript typecheck
- CLI build and compiled version smoke
- scanner benchmark
- Next.js production build

The Phase 5B security-sensitive diff was reviewed before merge and no merge-blocking issue remained.

## Exact next task

Design **Phase 5C Hosted Phase 3 finding import** before implementation.

The design should create a narrow trusted normalized-data adapter from existing local/CI Phase 3 output into the canonical hosted ledger. It must not create a second finding model or grant the hosted control plane arbitrary repository execution.

The design must define:

- repository/workspace binding
- trusted import caller and scan-run identity
- canonical hosted identity from Phase 3 fingerprints and source versions
- idempotent retry and conflicting-identity behavior
- permitted evidence kinds/classifications by scanner category
- strict path/source privacy policy
- secret redaction with no secret-value persistence
- bounded finding/evidence payloads and histories
- service-role-only mutation RPCs and RLS-protected reads
- append-only occurrence/event provenance
- lifecycle recurrence behavior over the canonical finding

Do not route Phase 3 output through runtime-only ingestion RPCs. Do not introduce repository cloning, package execution, arbitrary filesystem execution, generic runtime networking, or active testing as part of the import adapter.

## Boundaries that remain unchanged

Additional active validators require their own explicit design/security review. General crawling, arbitrary HTTP authority, authenticated testing, exploit probing, fuzzing, credential attacks, denial-of-service behavior, and generalized DAST remain out of scope.

Phase 6 remains queue-backed isolated workers, dedicated egress, concurrency/backpressure, private artifacts, fleet operations, and abuse controls. It must reuse existing target, authorization, budget, cancellation, finding, evidence, retest, and audit contracts without widening them.

## Resume protocol

Read in this order:

1. `docs/development/SESSION_HANDOFF.md`
2. `docs/development/CURRENT_STATE.md`
3. `docs/development/TEST_STATUS.md`
4. `docs/development/NEXT_STEPS.md`
5. `docs/ARCHITECTURE.md`
6. `docs/PHASES.md`
7. Phase 5B design/plan if remediation or retest details are needed
8. Confirm Phase 5B production migrations remain present if investigating production drift
9. Start Phase 5C with design/threat review before implementation
