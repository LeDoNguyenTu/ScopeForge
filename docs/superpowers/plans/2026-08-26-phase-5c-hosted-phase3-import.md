# Phase 5C Hosted Phase 3 Finding Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import privacy-reduced ScopeForge Phase 3 local/CI findings into the existing hosted canonical finding ledger for repository assets without adding hosted repository execution or new runtime-network authority.

**Architecture:** Add a dedicated local hosted-export envelope, a closed server-side Phase 3 source registry, a repository-bound import job/run record, and one atomic service-role-only persistence RPC. Reuse existing repository assets and canonical findings/evidence/occurrence/event tables; keep runtime ingestion unchanged.

**Tech Stack:** TypeScript, Next.js App Router, Supabase/Postgres, Vitest, existing ScopeForge scanner/security-domain packages.

**Spec:** `docs/superpowers/specs/2026-08-26-phase-5c-hosted-phase3-import-design.md`

## Global Constraints

- `security_findings` remains the only canonical finding state.
- Phase 5C is data import only and must not clone/fetch/execute repository content in the hosted control plane.
- Runtime-network authority remains limited to existing Phase 4B/4C services.
- Maximum hosted import body is 3.5 MB.
- Maximum 500 findings and 500 evidence rows per import.
- No raw secret, secret hash, source snippet, data-flow detail, arbitrary metadata, local absolute root, scanner diagnostics, or full SBOM body may cross the hosted boundary.
- Secret hosted locations omit exact columns.
- Browser roles remain SELECT-only for Phase 5C import state.
- Phase 5C mutation RPCs are `SECURITY DEFINER`, `search_path = ''`, revoked from public/anon/authenticated, granted only to service_role.
- Missing findings in later static scans never imply verified-fixed in Phase 5C v1.

---

### Task 1: Privacy-reduced hosted export contract

**Files:**
- Create: `packages/scanner-output/hosted/types.ts`
- Create: `packages/scanner-output/hosted/identity.ts`
- Create: `packages/scanner-output/hosted/serialize.ts`
- Create: `tests/scanner/output/hosted-json.test.ts`
- Modify: `packages/cli/run-cli.ts`
- Modify scanner output config type if format union is centralized there.

**Interfaces:**
- Produces `HostedPhase3EnvelopeV1`, `createHostedFindingIdentity`, `createHostedEvidenceIdentity`, `serializeHostedScanResult`.
- CLI supports `--format hosted-json --repository <canonical-public-github-url>`.

- [ ] Write tests proving deterministic output, repository-relative paths, versioned identities, 500-finding bound, metadata/snippet/data-flow/root/diagnostic non-copying, and secret-column removal.
- [ ] Run targeted tests and confirm RED because hosted output modules/format do not exist.
- [ ] Implement minimal hosted envelope types, identity hashing, privacy reducer and serializer.
- [ ] Extend CLI parser/rendering for `hosted-json` and required repository URL.
- [ ] Run targeted tests and full scanner output/CLI tests until GREEN.
- [ ] Commit `feat: add privacy-safe hosted Phase 3 export`.

### Task 2: Closed Phase 3 source registry and server validation

**Files:**
- Create: `lib/phase3-import/source-registry.ts`
- Create: `lib/phase3-import/validation.ts`
- Create: `tests/phase3-import/source-registry.test.ts`
- Create: `tests/phase3-import/validation.test.ts`

**Interfaces:**
- `resolvePhase3Source(scanner, ruleId, ruleVersion)` returns trusted hosted source/evidence/validation mapping or throws a safe import error.
- `validateHostedPhase3Envelope(value)` returns a bounded validated envelope.

- [ ] Write failing tests for unknown scanner/rule/version, traversal/absolute paths, malformed repository URL, forged fields, oversized collections/text and valid built-in mappings.
- [ ] Run targeted tests and confirm RED.
- [ ] Implement a registry derived from ScopeForge built-in rule metadata plus scanner grouping.
- [ ] Implement strict envelope validation that rejects extra/unsafe structure rather than copying it.
- [ ] Run tests GREEN and commit `feat: validate hosted Phase 3 imports`.

### Task 3: Phase 3 import database schema and authority boundary

**Files:**
- Create: `supabase/migrations/20260826100000_phase_5c_phase3_import_enum.sql`
- Create: `supabase/migrations/20260826100100_phase_5c_phase3_import.sql`
- Create: `tests/phase3-import/migration.test.ts`
- Modify: `lib/database.types.ts`

**Interfaces:**
- Add scan job kind `phase3_import`.
- Add `security_phase3_import_runs` table.
- Add service-role-only `persist_phase3_import_result(...)` RPC.

- [ ] Write migration tests asserting enum separation, RLS/SELECT-only table access, RPC grants/revokes/search path, repository asset checks, payload bounds, idempotency/conflict handling, immutable run rows, lifecycle recurrence and no runtime/network authority fields.
- [ ] Run targeted tests and confirm RED because migrations do not exist.
- [ ] Add enum migration first.
- [ ] Add Phase 5C schema, indexes, immutable guards, RLS and atomic persistence RPC.
- [ ] Extend generated/manual database types exactly to new schema/RPC.
- [ ] Run targeted migration/type tests GREEN and commit `feat: add Phase 3 hosted import persistence`.

### Task 4: Trusted repository/service layer

**Files:**
- Create: `lib/phase3-import/repository.ts`
- Create: `lib/phase3-import/service.ts`
- Create: `tests/phase3-import/service.test.ts`

**Interfaces:**
- `importHostedPhase3Result(input)` receives trusted actor/workspace context, repository asset and validated envelope; it cannot receive arbitrary lifecycle/source/network parameters.

- [ ] Write failing tests for unauthenticated/viewer/cross-workspace/repository mismatch, non-repository assets, exact idempotent retry, conflict propagation and admin-client-only mutation.
- [ ] Run targeted tests RED.
- [ ] Implement repository RPC wrapper and service authorization/binding.
- [ ] Run tests GREEN and commit `feat: add trusted Phase 3 import service`.

### Task 5: Authenticated upload route and request limits

**Files:**
- Create: `app/api/phase3-import/route.ts`
- Create: `tests/phase3-import/route.test.ts`

**Interfaces:**
- `POST /api/phase3-import` accepts multipart form data with `assetId` and one JSON file or an equivalent bounded JSON body if tests establish a simpler safe shape.
- Maximum accepted payload is 3.5 MB and MIME/type/content are validated before trusted persistence.

- [ ] Write failing tests for unauthenticated request, oversize request, missing/duplicate file, malformed JSON, non-repository asset, successful import and safe error mapping.
- [ ] Run tests RED.
- [ ] Implement minimal authenticated route with server-derived user/workspace and strict request parsing.
- [ ] Run tests GREEN and commit `feat: expose bounded Phase 3 import endpoint`.

### Task 6: Repository asset import UI and bounded history

**Files:**
- Create: `components/assets/Phase3ImportPanel.tsx`
- Create: `tests/phase3-import/panel.test.tsx`
- Modify: `app/dashboard/assets/[assetId]/page.tsx`
- Modify: `lib/phase3-import/repository.ts` for bounded history read if needed.

**Interfaces:**
- Panel appears only for repository assets and shows CLI command, privacy disclosure, upload, latest bounded import history and links to findings.

- [ ] Write failing component/page tests for repository-only rendering, command text, privacy disclosure, upload status and bounded history.
- [ ] Run tests RED.
- [ ] Implement panel and asset-detail read model.
- [ ] Ensure runtime/active controls remain unavailable for repository assets and import does not alter verification state.
- [ ] Run tests GREEN and commit `feat: add repository Phase 3 import UX`.

### Task 7: Finding-list scaling and architecture guards

**Files:**
- Modify: `lib/security-findings/repository.ts`
- Modify: `app/dashboard/findings/page.tsx`
- Create: `tests/phase3-import/architecture.test.ts`
- Add/update finding list tests as needed.

**Interfaces:**
- Canonical findings support bounded pagination/cursor or explicit load-more semantics without unbounded reads.

- [ ] Write failing tests for bounded pagination and dependency guards proving Phase 5C cannot import runtime-network, repository checkout/execution, package-manager execution or model-provider modules.
- [ ] Run tests RED.
- [ ] Implement minimal bounded findings paging and guards.
- [ ] Run tests GREEN and commit `feat: scale hosted finding reads for Phase 3`.

### Task 8: Full verification, documentation and production reconciliation

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PHASES.md`
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`

- [ ] Run full merge gate: `npm ci --ignore-scripts --no-audit --no-fund`, `npm test`, `npm run typecheck`, `npm run build:cli`, compiled CLI version smoke, scanner benchmark, `npm run build`.
- [ ] Perform targeted security diff review for source/asset binding, secret/path privacy, RPC privileges, idempotency and authority boundaries.
- [ ] Open/update PR and require exact-head CI green with no blocking review threads.
- [ ] Merge only with expected-head protection.
- [ ] Apply the two Phase 5C production migrations in repository order.
- [ ] Verify migration history, RLS, SELECT-only browser access, RPC execute privileges, indexes/constraints, read-only smoke query, Supabase security/performance advisors.
- [ ] Update permanent docs with exact PR head, CI evidence, merge SHA and live migration/advisor evidence.
