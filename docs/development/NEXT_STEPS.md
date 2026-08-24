# ScopeForge Next Steps

## Current completion gate: Phase 3O release hardening

The Phase 3 scanner feature set is implemented. PR #21 is the final Phase 3 release-hardening pull request.

The latest implementation GREEN checkpoint is CI #346 on `6ffb249c0ac7463c410cfd1536b105ebca9507d3`:

- reproducible `npm ci --ignore-scripts` install passed from committed lockfile v3
- 86 test files and 331 tests passed
- strict TypeScript typecheck passed
- CLI build and compiled `ScopeForge 0.1.0` smoke passed
- 700-file benchmark passed with 0 findings and 0 errors
- Next.js production build passed

The benchmark observation was 876 ms wall time, 816 ms scanner duration, and 17,399,808 bytes RSS delta on that GitHub-hosted runner. It is regression evidence, not a universal performance claim.

Before Phase 3 is declared complete:

1. Keep PR #21 in draft while permanent evidence documentation changes the head.
2. Review the complete final changed-file set and the Phase 3 trust boundaries.
3. Confirm no unresolved blocking review thread remains.
4. Mark PR #21 ready only when the documentation head is final.
5. Require the exact final PR head to pass:
   - `npm ci --ignore-scripts --no-audit --no-fund`
   - `npm test`
   - `npm run typecheck`
   - `npm run build:cli`
   - compiled CLI version smoke
   - `npm run benchmark:scanner`
   - `npm run build`
6. Squash merge PR #21 using expected-head protection.
7. Verify the merged `main` CI run is green.
8. Only then treat Phase 3 as complete.

## Phase 4 - Verified runtime and API security

Phase 4 is the next implementation boundary after Phase 3 completion.

Phase 4 must be designed before implementation because it introduces active remote behavior and materially different authorization and execution risks.

The approved long-term direction requires Phase 4 to preserve these principles:

- scan only assets with valid workspace authorization and proof of control
- separate local/passive scanning from active remote execution
- enforce explicit target scope, redirect, DNS, IP, port, and egress boundaries
- isolate active scanner workers from the web control plane
- apply strict request, time, concurrency, response-size, and cancellation budgets
- log security-relevant authorization and execution events
- distinguish observed runtime evidence from inference
- avoid persistence, destructive changes, credential attacks, denial of service, or unsafe side effects
- keep active validation narrow until worker isolation and authorization are proven

The first Phase 4 work should be an architecture and threat-model slice, not direct scanner implementation.

## Phase 4 design questions to resolve

The design should explicitly decide:

- active worker isolation model
- job queue and cancellation model
- workspace and asset authorization checks at enqueue and execution time
- DNS resolution and rebinding defenses for every outbound connection
- allowed schemes, ports, methods, redirects, and target transitions
- egress-deny defaults
- request and response budgets
- authenticated API secret storage and redaction boundaries, if authenticated testing is introduced
- audit records and operator-visible safety state
- initial DAST/API rule scope and false-positive controls
- artifact retention and private storage boundaries
- abuse prevention and quota enforcement
- local development/test harness for active scanning without unsafe internet targets

## Deferred beyond the first Phase 4 slice

Do not jump directly to:

- broad crawling
- generalized fuzzing
- exploit frameworks
- credential attacks
- cloud-account posture connectors
- persistence
- destructive validation
- arbitrary internet-wide scanning

Start with a narrow, highly bounded authorized runtime-security contract and expand only after its safety properties are testable and enforced.

## Resume protocol

Before a new implementation session:

1. Read `docs/development/SESSION_HANDOFF.md`.
2. Read `docs/development/CURRENT_STATE.md`.
3. Read `docs/scanner/RELEASE_READINESS.md`.
4. Confirm whether PR #21 and merged `main` completed the final Phase 3 gate.
5. If Phase 3 is complete, begin Phase 4 with architecture and threat-boundary design rather than active scanner code.
