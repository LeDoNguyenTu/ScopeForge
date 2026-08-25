# ScopeForge Session Handoff

## Current phase

Phase 5C Hosted Phase 3 finding import is complete in code and production database reconciliation.

- PR #37 merged as `2867e603df3e2430a78aaca8ba9cb6d09f6bdccb`
- exact reviewed PR head: `58d930685078df3ebd3c85fdf0d45007659e5704`
- production Supabase project: `tdgpibrepzcvdivztkta`
- Phase 5C production schema verified and advisor-reconciled

GitHub Actions monthly allowance was exhausted during PR #37. The user explicitly directed that ScopeForge continue without triggering, rerunning, or depending on GitHub Actions for the remainder of the month. Post-quota commits use `[skip ci]`.

Do not run GitHub Actions unless the user explicitly changes this instruction or the quota period is over.

## Completed platform work

- Phase 1 foundation complete.
- Phase 2 asset control and authorization complete.
- Phase 3 code and supply-chain security merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.
- Phase 4A security-domain contracts merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.
- Phase 4B passive runtime observations merged through PR #25 as `6879ff95f88be5cdb0eb0d7a94ef6ce56df0aa63`.
- Phase 4C-1 bounded CORS validation merged through PR #27 as `fb3aa27fac898cf20c87b57c86d6e8b2492fedd0`.
- Phase 5A hosted finding foundation delivered through PR #30.
- Phase 5B remediation, deterministic retest, and Security Story merged through PR #33 as `eb35c2b23468addd817951486c60ac7d68710c9a` and production-reconciled.
- Phase 5C hosted Phase 3 import merged through PR #37 as `2867e603df3e2430a78aaca8ba9cb6d09f6bdccb` and production-reconciled.

## Phase 5C implementation boundary

### Local/CI export

`scopeforge scan . --format hosted-json --repository <public-github-repo> --output scopeforge-hosted.json`

The versioned export includes bounded normalized scanner facts only. It excludes local roots, source code, snippets, data-flow traces, arbitrary metadata, scanner diagnostics, credentials, raw secret values, and SBOM bodies/artifacts.

Secret-specific hardening:

- no exact columns
- no local secret-derived fingerprint crosses the hosted boundary
- hosted secret fingerprints use reviewed rule/version + repository-relative path + line
- hosted secret evidence summaries are regenerated from reviewed rule metadata

### Trusted import

The Phase 5C server boundary:

- accepts one selected repository `assetId`
- derives actor/workspace/role from authenticated server context
- requires `application/json`
- enforces 3.5 MB from both declared length and streamed bytes
- validates a closed scanner/rule/version registry
- canonicalizes/recomputes the payload before accepting runRef
- rejects traversal, absolute paths, unsupported/extra fields, malformed repository identity, and oversized payloads
- derives canonical finding/evidence/source/provenance rows server-side
- never accepts arbitrary lifecycle, URL, request headers/body, budget, command, checkout, package-manager, or runtime-network authority

### Production persistence

Live Phase 5C migrations:

- `20260825210845 phase_5c_phase3_import_enum`
- `20260825211003 phase_5c_phase3_import`
- `20260825211239 phase_5c_phase3_import_fk_indexes`

The database has:

- `phase3_import` scan job kind
- immutable `security_phase3_import_runs`
- RLS member SELECT-only policy
- service-role-only `persist_phase3_import_result`
- terminal repository-import scan-job constraint
- exact retry advisory locking/idempotency
- conflict rejection
- canonical finding/evidence/occurrence/event reuse
- three covering indexes for Phase 5C foreign keys

Post-deployment verification confirmed:

- authenticated SELECT true, mutations false
- anon SELECT false
- RPC is `SECURITY DEFINER`
- RPC `search_path` is empty
- service_role EXECUTE true
- public/anon/authenticated EXECUTE false
- immutable triggers enabled
- intended constraints/indexes present
- import table smoke read succeeds and currently has zero rows
- security advisor clean
- no Phase 5C missing-FK-index notices
- remaining performance notices are INFO-level unused indexes
- live-generated Supabase TypeScript types confirm the new enum/table/RPC shape

## Phase 5C UI/read model

Repository asset detail provides:

- exact hosted-json CLI command
- privacy disclosure
- bounded JSON upload
- latest 20 import runs
- canonical findings navigation

Repository assets remain unsupported by passive runtime and active validation.

Canonical findings are paginated at 100 rows with one-row lookahead and deterministic `last_seen_at DESC, finding_id ASC` ordering.

## Security review findings fixed before merge

1. **Secret-derived hosted correlation token** - local secret `sfs1` identity included a secret-derived hash. Hosted export now re-keys secret fingerprints from safe rule/location identity only.
2. **Secret summary trust** - secret evidence summaries are regenerated from reviewed rule metadata instead of trusting scanner text.
3. **Finding pagination tie ordering** - identical import timestamps now have stable `finding_id` ordering.
4. **Phase 5C database type drift** - application types now include `phase3_import`, import-run table, persistence RPC, and existing retest recovery RPC.
5. **Missing Phase 5C FK indexes** - three advisor-reported missing covering indexes were added in a third migration and deployed.
6. **Architecture guard breadth** - trusted import guards now forbid HTTP/fetch, VM/worker authority, and model-provider/advisory-inference dependencies in addition to existing execution/network boundaries.

## Verification evidence

Pre-quota executable checkpoints include full-green Task 3 and Task 4 runs. CI #720 passed 156 test files / 701 tests, strict typecheck, CLI build/version smoke, and scanner benchmark before detecting an invalid Next.js route export during production build. That specific framework issue was corrected afterward by moving the transport constant outside the route module.

Later Actions jobs did not execute repository steps because the monthly allowance was exhausted.

The merged final head was not exact-head CI green. Final acceptance used:

- targeted security-sensitive code review
- live Supabase schema/privilege/constraint/index checks
- Supabase security/performance advisors
- live-generated TypeScript schema comparison
- local TypeScript syntax checks on final critical modules
- zero blocking PR review threads
- expected-head protected merge of exact head `58d930685078df3ebd3c85fdf0d45007659e5704`

## Exact next task

Begin **Phase 6 isolated workers and scanner scale** with design/threat modeling before implementation.

Define first:

- queue/job lifecycle
- worker lease and recovery semantics
- isolated execution workspace
- CPU/memory/time/file/byte budgets
- concurrency/backpressure
- cancellation race semantics
- private artifact classification/retention
- dedicated egress policy
- scanner/result provenance
- quotas, abuse controls, observability, and operational kill switches

Do not move repository cloning, package execution, generic outbound networking, or arbitrary caller configuration into the control plane. Worker isolation must preserve the security boundaries established in Phases 2-5.

## Resume protocol

Read in this order:

1. `docs/development/SESSION_HANDOFF.md`
2. `docs/development/CURRENT_STATE.md`
3. `docs/development/TEST_STATUS.md`
4. `docs/development/NEXT_STEPS.md`
5. `docs/ARCHITECTURE.md`
6. `docs/PHASES.md`
7. Phase 5C design/plan if import details are needed
8. Confirm the three Phase 5C production migrations remain present if investigating drift
9. Do not trigger GitHub Actions until the user explicitly changes the current instruction or the quota period is over
10. Start Phase 6 with a design and threat model before code