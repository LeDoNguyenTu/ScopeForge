# ScopeForge Next Steps

## Current completion gate: Phase 3O release hardening

The Phase 3 scanner feature set is implemented. PR #21 is the final Phase 3 release-hardening pull request.

Before Phase 3 is declared complete:

1. Review the complete PR #21 changed-file set and the Phase 3 trust boundaries.
2. Confirm no unresolved blocking review thread remains.
3. Mark PR #21 ready only after documentation is final.
4. Require the exact final PR head to pass:
   - `npm test`
   - `npm run typecheck`
   - `npm run build:cli`
   - compiled CLI version smoke
   - `npm run benchmark:scanner`
   - `npm run build`
5. Squash merge PR #21 using expected-head protection.
6. Verify the merged `main` CI run is green.
7. Only then treat Phase 3 as complete.

Diagnostic CI #311 already passed 85 test files / 329 tests, strict typecheck, CLI build/runtime, the 700-file benchmark, and the Next.js production build. That evidence validates the completion contracts and benchmark implementation, but it does not replace the required exact final documentation-head gate.

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
- avoid exploit behavior that causes persistence, destructive changes, credential attacks, denial of service, or unsafe side effects
- keep active validation narrow until the worker isolation and authorization model is proven

The first Phase 4 work should be an architecture/design slice, not direct scanner implementation.

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

Before any new implementation session:

1. Read `docs/development/SESSION_HANDOFF.md`.
2. Read `docs/development/CURRENT_STATE.md`.
3. Read `docs/scanner/RELEASE_READINESS.md`.
4. Confirm whether PR #21 and merged `main` completed the final Phase 3 gate.
5. If Phase 3 is complete, begin Phase 4 with design and threat-boundary work rather than scanner code.
