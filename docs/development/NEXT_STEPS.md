# ScopeForge Next Steps

## Phase 5B completion boundary

Phase 5B Remediation, Retest, and Security Story is merged through PR #33 as `eb35c2b23468addd817951486c60ac7d68710c9a`.

It extends the Phase 5A canonical hosted ledger without replacing it:

- workspace-scoped remediation assignment and bounded notes
- immutable retest source/profile snapshots
- atomic `resolved -> retest_pending` requests
- passive retests through the existing runtime observer
- active retests only through the existing `cors-origin-policy@1` validator
- owner/admin plus explicit consent for active retests
- exact job/workspace/asset/source/profile binding
- authoritative terminal outcome derived from database state
- fresh-evidence-only `verified_fixed`
- failed-start recovery and non-verified recovery to `in_progress`
- bounded retest history
- deterministic Security Story v1
- narrow server actions and finding-detail UI
- executable architecture and database authority guards

Exact PR head `5c7b8c34432f8bb51731fe069178411a8005d023` passed CI #685 with 148 test files / 654 tests, strict typecheck, CLI build/version smoke, scanner benchmark, and production build before expected-head merge.

## Immediate operational task - deploy Phase 5B database migrations

Production Supabase migration history currently ends at Phase 5A. Before treating the hosted Phase 5B workflow as production-ready, deploy the two already-reviewed migrations in repository order:

1. `20260825090000_phase_5b_remediation_retest_security_story.sql`
2. `20260825091000_phase_5b_retest_recovery_hardening.sql`

Then verify:

- both migrations appear in production migration history
- `security_finding_work` and `security_finding_retests` exist
- RLS is enabled on both workflow tables
- authenticated users retain SELECT-only access
- all Phase 5B mutation RPCs remain inaccessible to `public`, `anon`, and `authenticated`
- service role retains mutation RPC execution
- Supabase security advisor remains clean
- the four Phase 5A missing-FK-index INFO notices disappear
- a read-only smoke query can resolve the new tables/functions

Do not paper over production drift by changing application behavior or weakening tests.

## Next design boundary - Phase 5C Hosted Phase 3 finding import

ScopeForge already has a capable local/CI Phase 3 scanner, but hosted ingestion currently accepts deterministic runtime findings only. The next useful product step is a reviewed adapter that brings existing code and supply-chain findings into the same canonical hosted ledger without creating a second finding model.

The design must answer these questions explicitly:

- What trusted caller/import boundary may submit Phase 3 scan results?
- How is a repository represented and bound to a workspace/asset without pretending it is a runtime target?
- How do Phase 3 stable fingerprints and scanner source versions map to canonical hosted finding identity?
- What is the hosted scan-run identity and how are retries made idempotent?
- Which evidence kinds are permitted from secrets, SAST, taint, SCA, SBOM, Docker, Kubernetes, Terraform, GitHub Actions, and configuration scanners?
- Which source paths, snippets, dependency metadata, and artifact references may be stored, and at what classification?
- How are detected secrets and secret-adjacent context redacted before crossing the hosted boundary?
- How are payload sizes, finding counts, text fields, evidence summaries, and history reads bounded?
- Which fields are immutable, which canonical fields can refresh on recurrence, and which lifecycle states reopen on fresh deterministic evidence?
- Which mutation RPCs are service-role-only and which reads are available through RLS?
- How do local/CI scan provenance and hosted audit history remain attributable?
- How does the adapter avoid importing scanner execution, filesystem authority, package-manager execution, or generic runtime-network authority into the hosted control plane?

### Phase 5C invariants

- `security_findings` remains the only canonical finding state.
- Do not route Phase 3 findings through runtime-only ingestion RPCs by convenience.
- Hosted import is a trusted data-ingestion boundary, not hosted arbitrary repository execution.
- The server must never persist secret values or unbounded source content.
- Browser roles remain read-only for canonical finding/evidence/import state.
- Import mutation RPCs independently validate workspace/repository/run/finding/evidence binding.
- Retry is idempotent and conflicting identity reuse is rejected.
- Evidence remains immutable and recurrence appends occurrence/history.
- Advisory/model output cannot independently alter validation or lifecycle state.
- No new remote active-testing authority is introduced.

## Phase 6 after hosted import

Production scanner scale remains a separate architecture boundary. Queue-backed isolated workers, worker leases, dedicated egress policy, concurrency/backpressure, CPU/memory/time budgets, cancellation, private artifacts, fleet operations, and abuse controls must reuse the target, authorization, budget, evidence, finding, and audit contracts already established.

Moving runtime execution to workers must not widen target policy or active request authority.

## Active-testing boundary remains narrow

Additional active profiles require their own explicit design/security review. Still out of scope without a new approved active design:

- broad crawling or endpoint discovery
- OPTIONS/preflight probing
- user-supplied origins
- arbitrary methods/headers/bodies
- authenticated/cookie/credential replay
- SQLi/XSS/SSRF exploit probes
- fuzzing or credential attacks
- denial-of-service behavior
- generalized exploit confirmation

## Future AI work

Do not add a provider merely to demonstrate model connectivity. If a later workflow benefits from assistance, place the provider behind the existing provider-neutral advisory seam, apply context/privacy policy before the provider boundary, validate output into inferred domain types, and keep the core product functional with no provider configured.

## Resume protocol

Before a new implementation session:

1. Read `docs/development/SESSION_HANDOFF.md`.
2. Read `docs/development/CURRENT_STATE.md`.
3. Read `docs/development/TEST_STATUS.md`.
4. Read `docs/ARCHITECTURE.md` and `docs/PHASES.md`.
5. Confirm PR #33 / merge `eb35c2b23468addd817951486c60ac7d68710c9a` is present on `main`.
6. Confirm whether both Phase 5B migrations are present in production before debugging hosted Phase 5B behavior.
7. Complete production migration verification if still pending.
8. Start Phase 5C with a design/spec and threat/security review before implementation.
9. Preserve the canonical ledger, immutable evidence, narrow mutation authority, and existing runtime/network boundaries.
