# ScopeForge Session Handoff

## Current phase

Phase 5A Hosted Finding Foundation is implemented in PR #30 and this documentation is part of that delivery. The next design boundary is Phase 5B - Security Stories, remediation, and retest workflow.

Approved Phase 5A design:

- `docs/superpowers/specs/2026-08-25-phase-5a-hosted-finding-foundation-design.md`

Approved Phase 5A implementation plan:

- `docs/superpowers/plans/2026-08-25-phase-5a-hosted-finding-foundation.md`

## Completed platform work

- Phase 1 foundation complete.
- Phase 2 asset control and authorization complete.
- Phase 3 code and supply-chain security merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.
- Phase 4A security-domain contracts merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.
- Phase 4B passive runtime observations merged through PR #25 as `6879ff95f88be5cdb0eb0d7a94ef6ce56df0aa63`.
- Phase 4C-1 bounded CORS validation merged through PR #27 as `fb3aa27fac898cf20c87b57c86d6e8b2492fedd0`.
- Phase 5A hosted finding foundation delivered by PR #30.

## Phase 5A completed boundary

### Hosted ledger

Phase 5A introduces one canonical workspace-scoped ledger:

- `security_findings` - current finding state
- `security_evidence` - immutable normalized evidence
- `security_finding_evidence` - append-only links
- `security_finding_occurrences` - append-only recurrence per trusted scan job
- `security_finding_events` - append-only system/operator history

Authenticated clients receive RLS-protected SELECT access only. Direct browser INSERT/UPDATE/DELETE and direct execution of trusted mutation RPCs are not granted.

### Atomic passive/active ingestion

`lib/runtime-observations` and `lib/active-validation` persist their normalized runtime observation plus hosted finding/evidence batch through separate service-role-only PostgreSQL RPCs:

- `persist_passive_runtime_result`
- `persist_active_validation_result`

Each RPC is `SECURITY DEFINER` with an empty pinned search path. It locks the exact job/workspace/asset row, requires the expected running and uncancelled job kind, validates the normalized observation, and performs finding/evidence ingestion in the same transaction.

The hosted ingestion boundary accepts only:

- `deterministic-runtime-scanner`
- scanner-derived finding provenance
- `runtime_observed` or `runtime_validated`
- observed HTTP/TLS evidence
- `public` evidence classification
- exact asset binding
- bounded text and JSON
- evidence refs present in the trusted batch

No hosted Phase 3 import is enabled.

### Identity and immutable evidence

Finding IDs stay semantic and stable across recurrence. Passive finding identity includes `RUNTIME_SOURCE_VERSION`; active finding identity remains scoped to `cors-origin-policy@1`.

Evidence IDs are content-specific: the stable finding digest is extended with bounded evidence kind, classification, and summary content. This prevents immutable evidence-ID conflicts when a stable finding is observed again with changed evidence content.

### Recurrence

One occurrence is recorded per `(workspace, finding, scan job)`. Retry of the same committed batch is idempotent. New evidence links are appended without mutating prior evidence.

Only observations at least as recent as current `last_seen_at` refresh canonical descriptive/validation fields.

Trusted recurrence policy:

- `resolved` -> `in_progress`
- `retest_pending` -> `in_progress`
- `verified_fixed` -> `open`
- `accepted_risk` unchanged
- `false_positive` unchanged

### Human lifecycle workflow

Phase 5A exposes only:

- open -> acknowledged
- open -> in progress
- acknowledged -> in progress
- in progress -> resolved
- resolved -> in progress

Owner/admin/member can perform these actions; viewer is read-only. Resolve and reopen require a note no longer than 1000 characters.

The server action accepts only finding ID, narrow action enum, and optional note. PostgreSQL independently rechecks actor membership/role, locks the canonical finding, checks expected state and transition, updates the current row, and appends the lifecycle event atomically.

Risk acceptance, false-positive workflow, retest-pending/verified-fixed operator actions, Security Stories, and model-driven lifecycle changes remain out of scope.

### Read model and UI

- dedicated `/dashboard/findings` list
- dedicated finding detail view
- canonical asset/rule/source/severity/confidence/validation display
- normalized evidence display
- occurrence history
- lifecycle history
- limited lifecycle controls
- dashboard open-finding count
- Findings navigation entry

Read queries are workspace-scoped and bounded to 100 rows for lists/evidence/history. The dashboard uses a count-only query for active findings.

### Architecture/security guards

Executable tests prevent:

- hosted finding services from importing generic runtime-network or scanner execution authority
- runtime observer/validator packages from depending back on hosted finding persistence
- passive/active repositories from bypassing their dedicated result RPCs
- authenticated browser mutation grants on hosted ledger tables
- mutation RPC execution by public/anon/authenticated roles
- raw response/body/cookie/credential-style columns from being added to the hosted ledger

## Security review findings already fixed

Two issues were found and fixed before final merge preparation:

1. Immutable evidence reused the stable finding digest and could conflict when evidence content changed. Fixed with content-specific evidence identity while preserving stable finding identity.
2. Findings/detail reads and dashboard aggregation were initially unbounded. Fixed with explicit 100-row caps and a count-only dashboard query.

Both were introduced as RED regressions first and then fixed without weakening tests.

## Verification state

Last implementation/security-guard checkpoint before docs:

- head: `3d71ac3b408828608e9173d77db3c739a86f4710`
- CI: #618
- 131 test files / 579 tests
- strict typecheck passed
- CLI build/version passed
- benchmark passed
- Next.js production build passed

A full exact-head gate is still mandatory after the documentation tail and immediately before merge.

## Next boundary - Phase 5B

Design before implementation. Phase 5B should define:

- remediation ownership/work tracking without duplicating findings
- accepted-risk and false-positive authorization/audit policy
- retest request and execution binding
- evidence required for `retest_pending` and `verified_fixed`
- Security Story explanation model/view with provenance and uncertainty
- evidence versus inference presentation
- developer versus security views over one canonical state
- model/advisory boundaries that cannot independently alter validated security state

Hosted Phase 3 import remains a separate reviewed design task.

Additional active validators also remain separate design/security boundaries. General crawling, arbitrary HTTP authority, authenticated testing, exploit probing, fuzzing, credential attacks, DoS, and generalized DAST remain out of scope.

Worker-scale queues, isolated workers, dedicated egress, concurrency/backpressure, private artifacts, fleet operations, and abuse controls remain Phase 6.

## Resume protocol

Read in this order:

1. `docs/development/SESSION_HANDOFF.md`
2. `docs/development/CURRENT_STATE.md`
3. `docs/development/TEST_STATUS.md`
4. `docs/ARCHITECTURE.md`
5. `docs/PHASES.md`
6. Phase 5A design/plan when hosted finding details are needed
7. Confirm PR #30 is on `main`
8. Start Phase 5B with design/threat/security review before implementation
