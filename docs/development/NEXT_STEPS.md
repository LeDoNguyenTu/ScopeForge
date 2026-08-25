# ScopeForge Next Steps

## Phase 5B completion boundary

Phase 5B Remediation, Retest, and Security Story is merged through PR #33 as `eb35c2b23468addd817951486c60ac7d68710c9a` and is now production-reconciled.

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

Production Supabase now contains both Phase 5B migrations. Post-deployment verification confirms RLS, SELECT-only browser access, service-role-only mutation RPCs, empty pinned search paths, snapshot/recovery constraints and triggers, the intended foreign-key covering indexes, smoke-readable tables, and a clean security advisor. The prior missing-FK-index notices are resolved.

## Next design boundary - Phase 5C Hosted Phase 3 finding import

ScopeForge already has a capable local/CI Phase 3 scanner, but hosted ingestion currently accepts deterministic runtime findings only. The next product step is a reviewed adapter that brings existing code and supply-chain findings into the same canonical hosted ledger without creating a second finding model or granting hosted repository execution authority.

The design must answer these questions explicitly:

- What trusted caller/import boundary may submit normalized Phase 3 scan results?
- How is a repository represented and bound to a workspace without pretending it is a runtime web/API target?
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
- Hosted import is a trusted normalized-data ingestion boundary, not hosted arbitrary repository execution.
- The server must never persist secret values or unbounded source content.
- Browser roles remain read-only for canonical finding/evidence/import state.
- Import mutation RPCs independently validate workspace/repository/run/finding/evidence binding.
- Retry is idempotent and conflicting identity reuse is rejected.
- Evidence remains immutable and recurrence appends occurrence/history.
- Advisory/model output cannot independently alter validation or lifecycle state.
- No new remote active-testing authority is introduced.

## Recommended Phase 5C architecture direction

Prefer a dedicated hosted import boundary rather than extending the runtime persistence RPCs.

Conceptually:

```text
local/CI ScopeForge scanner
        |
        v
normalized Phase 3 export
        |
        v
trusted hosted import service
        |
        +--> strict privacy/redaction validation
        +--> repository + scan-run binding
        +--> Phase 3 adapter into canonical security-domain types
        |
        v
service-role-only atomic import RPC
        |
        +--> canonical security_findings
        +--> immutable security_evidence
        +--> append-only occurrences/events
        +--> Phase 5C repository/run metadata
```

The import service should accept only a closed, versioned ScopeForge export contract produced by existing normalized scanner output. It should not accept arbitrary filesystem paths, repository URLs to clone, commands to run, package-manager options, or caller-controlled execution configuration.

Repository identity and scan-run provenance should be first-class hosted metadata, while the finding itself remains in `security_findings`. Phase 3 evidence should use category-specific bounded summaries rather than uploading arbitrary source fragments.

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
5. Confirm PR #33 and the Phase 5B documentation follow-ups are present on `main`.
6. Treat Phase 5B production reconciliation as complete unless current Supabase verification proves otherwise.
7. Start Phase 5C with a design/spec and threat/security review before implementation.
8. Preserve the canonical ledger, immutable evidence, narrow mutation authority, and existing scanner/runtime/network boundaries.
