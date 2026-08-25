# ScopeForge Next Steps

## Phase 5A completion boundary

Phase 5A Hosted Finding Foundation is implemented in delivery PR #30. It establishes the durable product ledger that later Phase 5 work must extend rather than replace:

- one canonical workspace-scoped finding table
- immutable normalized evidence
- append-only finding/evidence links, occurrences, and events
- atomic passive/active runtime result persistence
- stable finding identity plus content-specific immutable evidence identity
- trusted recurrence and reopen semantics
- limited audited human lifecycle workflow
- bounded RLS-protected findings list/detail reads
- findings navigation and dashboard count integration
- executable architecture/security guards

The last code/security-guard checkpoint before the documentation tail was CI #618 on head `3d71ac3b408828608e9173d77db3c739a86f4710`: 131 test files / 579 tests plus typecheck, CLI build/version, benchmark, and production build.

PR #30 still requires the same full gate on its exact final head before merge. Merge must use expected-head protection.

## Next planned design boundary - Phase 5B

Design **Security Stories, remediation, and retest workflow** before implementation.

The 5B design should answer these questions explicitly:

- How are remediation ownership, status, notes, and due/priority metadata represented without duplicating the canonical finding?
- Which lifecycle transitions introduce `retest_pending` and `verified_fixed`, and which actor/evidence is authoritative for each transition?
- How does a retest bind back to the exact finding, asset, trusted execution, and evidence history?
- How are evidence and inference shown together without allowing inferred/model output to masquerade as observed validation?
- What is a Security Story object/view: a materialized record, derived view, or advisory output attached to the canonical finding?
- Which developer-oriented and security-oriented views are different presentations of the same canonical state?
- How should accepted-risk and false-positive workflows be authorized, justified, audited, and reopened on later evidence?

### 5B invariants

- Do not create a second finding model.
- Deterministic scanner/runtime evidence or explicit human workflow remains authoritative for security state.
- Advisory/model output stays inferred and cannot independently mark a finding validated, fixed, accepted-risk, or false-positive.
- Retest/verified-fixed must require fresh trusted evidence rather than an operator button alone.
- Lifecycle/event mutations remain atomic, workspace-scoped, audited, and inaccessible directly from browser database roles.
- New read models must remain bounded/paginated.
- Evidence remains immutable; new observations append evidence/occurrence/history instead of mutating prior evidence.

## Hosted Phase 3 import

Hosted import of Phase 3 local scanner findings is still not authorized. Before enabling it, design a reviewed adapter that defines:

- canonical hosted identity for Phase 3 fingerprints and source versions
- evidence kinds/classification permitted for hosted storage
- path/source privacy and secret-redaction rules
- idempotent import/retry behavior
- asset/repository binding
- occurrence provenance and scan-run identity
- browser versus trusted-service authority

Do not route Phase 3 output through the runtime-only ingestion contract by convenience.

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

## Worker-scale runtime execution

Production runtime scale remains Phase 6. Queue-backed isolated workers, dedicated egress policy, concurrency/backpressure, private artifacts, fleet operations, and abuse controls must reuse the existing target, authorization, budget, cancellation, network, evidence, finding, and audit contracts rather than widening them.

## Future AI work

Do not add a provider merely to demonstrate model connectivity. If a concrete Phase 5B Security Story workflow benefits from assistance, place the provider behind the existing provider-neutral advisory seam, apply context/privacy policy before the provider boundary, validate output into inferred domain types, and keep the core product functional with no provider configured.

## Resume protocol

Before a new implementation session:

1. Read `docs/development/SESSION_HANDOFF.md`.
2. Read `docs/development/CURRENT_STATE.md`.
3. Read `docs/development/TEST_STATUS.md`.
4. Read `docs/ARCHITECTURE.md` and `docs/PHASES.md`.
5. Confirm PR #30/Phase 5A is present on `main` before starting 5B implementation.
6. Start Phase 5B with a design/spec and threat/security review before code.
7. Preserve the existing canonical ledger and narrow runtime/network authority.
