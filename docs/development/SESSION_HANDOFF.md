# ScopeForge Session Handoff

## Current phase

Phase 4A - security domain contracts, final completion gate.

Active branch: `feat/phase-4a-security-domain-contracts`

Active PR: #23 `Build Phase 4A security domain contracts`

Approved design and implementation plan were merged through PR #22 as `13fb2c3e914181d44f9e6957f9fe66eea2069eb4`.

## Completed platform work

- Phase 1 foundation is complete.
- Phase 2 asset control and authorization is complete.
- Phase 3 code and supply-chain security is complete and merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.
- Phase 4A Tasks 1 through 5 are implemented in PR #23.

## Phase 4A implementation

### Product domain

`packages/security-domain` now contains pure, framework-independent contracts for:

- contract versioning and branded identifiers
- severity and confidence
- finding sources and provenance
- typed evidence and content classification
- product findings and locations
- remediation
- validation states and authority-aware transitions
- finding lifecycle transitions
- typed risk relationships
- provider-neutral advisory requests/results/service
- advisory context privacy and size policy

### Future AI seam

The advisory boundary is intentionally provider-neutral:

- advisory results are always inferred provenance
- advisory authority cannot promote validation
- secret-classified context is always excluded
- remote sensitive context requires explicit opt-in
- no provider SDK type is allowed in `security-domain`
- local or hosted adapters can be introduced later without changing scanner/domain contracts
- core scanning and security workflows remain fully usable without AI

There is no model runtime or provider call in Phase 4A.

### Phase 3 adapter

`packages/security-domain-adapters/phase3` maps normalized Phase 3 findings into the product domain.

It is deliberately one-way and does not copy scanner metadata, baseline state, redacted snippets, or data-flow internals. It performs no repository read, scanner rerun, environment access, process execution, or network work.

### Architecture guard

`tests/architecture/security-domain-dependencies.test.ts` prevents `packages/security-domain` from importing scanner packages, CLI code, Next.js, React, Supabase, application/component layers, or named model providers.

## TDD and verification evidence

Intentional RED checkpoints established the new contracts without hiding existing regressions:

- Task 1 RED: all 331 existing tests stayed green; only the missing new domain module failed.
- Tasks 2/3 RED: failures were isolated to missing lifecycle, validation, and advisory behavior.
- Task 4 RED, CI #370: 91 existing test files and 346 existing tests passed; only the missing Phase 3 adapter suite failed.

Supporting GREEN gates:

- Task 1: CI #363 passed the complete gate.
- Tasks 2/3: CI #367 passed the complete gate.
- Phase 3 adapter: CI #373 passed the complete gate.
- Architecture guard and documentation: CI #375 passed the complete gate on `c0e93ac0408a01a8c2b1ec513e38286a7f102cef`.

CI #375 evidence:

- 93 test files
- 350 tests
- strict TypeScript typecheck
- CLI build
- compiled `ScopeForge 0.1.0` smoke
- 700-file benchmark with 0 findings and 0 errors
- scanner duration 860 ms
- wall time 919 ms
- RSS delta 28,692,480 bytes
- Next.js production build

CI #375 is supporting evidence only because the permanent state documentation changes the head afterward.

## Database and active-scanning status

Phase 4A has no Supabase migration, schema, RLS, RPC, storage, queue, worker, or hosted-ingestion change. Database advisor checks are not a PR #23 merge dependency.

Phase 4A also has no remote DAST, crawler, fuzzing, exploit validation, credential attack, persistence, destructive action, or active worker execution.

## Exact remaining actions

1. Commit this final permanent state documentation set.
2. Review the complete PR #23 diff against the approved design and security boundary.
3. Confirm no unresolved blocking review thread exists.
4. Mark PR #23 ready.
5. Require a new complete CI run on the exact final documentation head.
6. Update PR metadata without changing the verified head.
7. Squash merge with expected-head protection.
8. Verify merged content and `main` CI if exposed by the available GitHub tooling.
9. Clean merged historical branches while preserving `main` and open work.
10. Start Phase 4B verified passive runtime/API observation design.

## Next boundary

Phase 4B must reuse `security-domain` and preserve Phase 2 authorization/network safety. It should establish passive authorized runtime observation and worker/network safety contracts before Phase 4C introduces any bounded active validation.

## Resume protocol

Read in this order:

1. `docs/development/SESSION_HANDOFF.md`
2. `docs/development/CURRENT_STATE.md`
3. `docs/development/TEST_STATUS.md`
4. `docs/ARCHITECTURE.md`
5. `docs/roadmap/FUTURE_AI_ASSISTANCE.md`
6. PR #23 exact head and CI/merge state

Do not infer final Phase 4A completion from CI #375. The exact final documentation head must pass and the merge must be verified first.
