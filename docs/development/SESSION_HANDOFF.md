# ScopeForge Session Handoff

## Current phase

Phase 5B Remediation, Retest, and Security Story is implemented and merged through PR #33.

- last merged application commit: `eb35c2b23468addd817951486c60ac7d68710c9a`
- Phase 5B exact reviewed PR head: `5c7b8c34432f8bb51731fe069178411a8005d023`
- exact-head CI: #685
- current documentation follow-up branch: `docs/phase-5b-completion-handoff`

Phase 5B application code is merged, but the production Supabase migration history still ends at Phase 5A. The two Phase 5B migrations must be deployed and verified before the hosted workflow is considered production-ready.

The next product design boundary after production reconciliation is Phase 5C Hosted Phase 3 finding import.

## Approved designs and plans

Phase 5A:

- `docs/superpowers/specs/2026-08-25-phase-5a-hosted-finding-foundation-design.md`
- `docs/superpowers/plans/2026-08-25-phase-5a-hosted-finding-foundation.md`

Phase 5B:

- `docs/superpowers/specs/2026-08-25-phase-5b-remediation-retest-security-story-design.md`
- `docs/superpowers/plans/2026-08-25-phase-5b-remediation-retest-security-story.md`

## Completed platform work

- Phase 1 foundation complete.
- Phase 2 asset control and authorization complete.
- Phase 3 code and supply-chain security merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.
- Phase 4A security-domain contracts merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.
- Phase 4B passive runtime observations merged through PR #25 as `6879ff95f88be5cdb0eb0d7a94ef6ce56df0aa63`.
- Phase 4C-1 bounded CORS validation merged through PR #27 as `fb3aa27fac898cf20c87b57c86d6e8b2492fedd0`.
- Phase 5A hosted finding foundation delivered through PR #30.
- Phase 5B remediation, deterministic retest, and Security Story merged through PR #33 as `eb35c2b23468addd817951486c60ac7d68710c9a`.

## Phase 5B completed boundary

### Remediation work

Phase 5B adds one workflow row per canonical workspace finding in `security_finding_work`.

- owner/admin may assign current workspace members
- member may self-assign only
- viewer remains read-only
- remediation note maximum is 2000 characters
- assignment and note changes append events
- authenticated browser roles receive RLS-protected SELECT only
- mutation is service-role-only and the database independently re-checks actor membership/role

### Deterministic retest

`security_finding_retests` stores immutable retest snapshots and bounded terminal history.

Only two existing runtime authorities may be reused:

- passive: `scopeforge:runtime-observer` version `0.1`
- active: `scopeforge:runtime-validator` version `cors-origin-policy@1`

No generic request authority was added.

Retest request:

- requires a supported `resolved` finding
- locks canonical state
- prevents a second active retest
- records source/profile snapshot
- active path requires owner/admin plus explicit consent
- transitions `resolved -> retest_pending`
- appends request history atomically

Execution:

- enqueues through the existing passive or active service
- attaches only an exact matching queued scan job
- validates workspace, asset, requester, job kind, source/profile, and active authorization
- executes using the existing fixed budgets and runtime safety controls
- finalizes from authoritative database state

Verified-fixed semantics:

- target job must succeed
- exact source/profile snapshot must match
- target finding must not occur in that exact retest job
- canonical finding must still be `retest_pending`
- only then can canonical state become `verified_fixed`

Failed, blocked, cancelled, stale, mismatched, or still-present retests cannot verify a fix. A recovery trigger returns a still-pending finding to `in_progress` for non-verified terminal outcomes.

### Security Story v1

Security Story v1 is a deterministic bounded read model over the canonical finding, immutable evidence/history, remediation work, and retest state.

It has no model provider, network authority, Supabase write authority, or lifecycle mutation ability. It distinguishes attributable evidence/workflow facts from explanatory text and only reports a verified fix when canonical and authoritative retest state agree.

### UI and action boundary

Finding detail now includes remediation controls, retest controls/history, active consent where applicable, and Security Story v1.

Server actions do not accept arbitrary target URL, method, headers, body, budget, source/profile, scan-job ID, desired terminal result, or generic lifecycle target.

## Security review

The Phase 5B security-sensitive diff was reviewed before merge, including:

- server context identity/workspace derivation
- workspace/role rechecks in privileged RPCs
- service-role-only mutation privileges
- `SECURITY DEFINER` functions with `search_path = ''`
- immutable retest source/profile snapshots
- active owner/admin consent
- exact job/workspace/asset/requester binding
- fresh-evidence-only verified-fix finalization
- failed-start and non-verified recovery
- dependency guards preventing generic runtime-network authority in remediation code

No merge-blocking security issue remained at the exact reviewed head.

## Verification state

CI #685 passed on exact PR head `5c7b8c34432f8bb51731fe069178411a8005d023`:

- `npm ci --ignore-scripts --no-audit --no-fund`
- 148 test files / 654 tests
- strict TypeScript typecheck
- CLI build
- compiled CLI version smoke: `ScopeForge 0.1.0`
- scanner benchmark: 700 files, 0 errors, 1111 ms wall time against 20000 ms limit
- Next.js production build

PR #33 was then merged with expected-head protection as `eb35c2b23468addd817951486c60ac7d68710c9a`.

## Production Supabase state

Project: ScopeForge

The project is healthy, but migration history currently ends at:

- `20260825004547 phase_5a_hosted_finding_foundation`

The following repository migrations are merged but not yet present in production history:

1. `20260825090000_phase_5b_remediation_retest_security_story.sql`
2. `20260825091000_phase_5b_retest_recovery_hardening.sql`

Pre-deployment advisor state:

- security advisor: clean
- performance advisor: four INFO missing-FK-covering-index notices from Phase 5A plus existing unused-index INFO notices

The first Phase 5B migration intentionally creates covering indexes for those four Phase 5A foreign keys.

## Exact next task

1. Apply the two already-reviewed Phase 5B migrations to production in repository order.
2. Re-read migration history and confirm both versions are present.
3. Smoke-check `security_finding_work` and `security_finding_retests`.
4. Verify RLS and SELECT-only browser authority.
5. Verify Phase 5B mutation RPCs are not executable by `public`, `anon`, or `authenticated` and remain executable only by the trusted service role.
6. Re-run Supabase security and performance advisors.
7. Finish the `docs/phase-5b-completion-handoff` PR with the verified production state and merge it after exact-head CI.
8. Start Phase 5C Hosted Phase 3 finding import with a design/spec and threat/security review before implementation.

## Phase 5C design boundary

The next design should create a narrow trusted adapter for normalized Phase 3 local/CI results rather than a new hosted scanner authority.

It must define:

- repository/workspace/asset binding
- trusted import caller and scan-run identity
- stable hosted identity from Phase 3 fingerprints and source versions
- idempotent retry semantics
- evidence kinds/classifications allowed for hosted storage
- path/source privacy policy
- strict secret redaction and no secret-value persistence
- bounded finding/evidence payloads and histories
- service-role-only mutations and RLS-protected reads
- append-only occurrence/event provenance
- recurrence/lifecycle semantics over the existing canonical finding

Do not route Phase 3 output through runtime-only ingestion contracts. Do not introduce package execution, arbitrary filesystem authority, generic runtime networking, or active testing as part of the import adapter.

## Boundaries that remain unchanged

Additional active validators require their own design/security review. General crawling, arbitrary HTTP authority, authenticated testing, exploit probing, fuzzing, credential attacks, denial-of-service behavior, and generalized DAST remain out of scope.

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
8. Confirm PR #33 merge is present on `main`
9. Confirm production migration state before debugging hosted Phase 5B behavior
10. If Phase 5B production is reconciled, start Phase 5C with design/threat review before implementation
