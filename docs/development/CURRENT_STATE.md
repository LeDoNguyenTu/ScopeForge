# ScopeForge Current State

## Product direction

ScopeForge is an open-source application-security and cyber-risk awareness platform built around:

`Discover -> Validate -> Explain -> Connect -> Prepare -> Fix -> Verify`

Authorization, deterministic evidence, explanation, remediation, and execution authority remain separate concerns. Security state must remain attributable to deterministic/runtime evidence or explicit human workflow rather than model inference alone.

## Completed foundations

- **Phase 1 Foundation** - Next.js/React shell, Supabase auth/workspaces, RLS, security headers, and deployment baseline.
- **Phase 2 Asset control and authorization** - workspace-scoped assets, canonical targets, proof of control, SSRF-safe verification, roles, quotas, audit events, and asset UX.
- **Phase 3 Code and supply-chain security** - local/passive scanner with hostile-repository safety, secrets, JavaScript/TypeScript SAST and bounded command taint, npm SCA/SBOM, IaC/configuration analysis, baselines, JSON/SARIF, golden outputs, and benchmarks. Merged through PR #21 as `86fb5c561e5b49fbf84eaef454fbaaa71b67bd3e`.
- **Phase 4A Security domain contracts** - canonical framework-independent finding/evidence/provenance/validation/lifecycle/remediation/relationship contracts. Merged through PR #23 as `56192756079375957c4918a2be5cfbfb30a33376`.
- **Phase 4B Verified passive runtime observations** - verified targets, reauthorization, DNS/IP safety, pinned HTTPS, bounded passive observations, cancellation, deterministic runtime findings, and trusted persistence. Merged through PR #25 as `6879ff95f88be5cdb0eb0d7a94ef6ce56df0aa63`.
- **Phase 4C-1 Bounded CORS origin-policy validation** - separate owner/admin-authorized active profile `cors-origin-policy@1` with one fixed-origin GET and no generic request authority. Merged through PR #27 as `fb3aa27fac898cf20c87b57c86d6e8b2492fedd0`.
- **Phase 5A Hosted finding foundation** - one workspace-scoped canonical hosted finding ledger, immutable evidence, append-only recurrence/history, atomic runtime ingestion, bounded read models, and narrow lifecycle workflow. Delivered through PR #30.
- **Phase 5B Remediation, deterministic retest, and Security Story** - merged through PR #33 as `eb35c2b23468addd817951486c60ac7d68710c9a` and production-reconciled.
- **Phase 5C Hosted Phase 3 finding import** - implementation complete on PR #37 and production database schema reconciled. Final PR merge is pending the no-GitHub-Actions verification/documentation gate described below.

## Phase 5C delivered boundary

### Privacy-reduced local/CI export

The CLI supports:

```text
scopeforge scan . --format hosted-json --repository https://github.com/owner/repo --output scopeforge-hosted.json
```

The hosted envelope is versioned, deterministic, repository-bound, and capped at 500 findings. It excludes local absolute roots, arbitrary scanner metadata, source code, redacted snippets, data-flow traces, scanner diagnostic text, credentials, raw secrets, and SBOM bodies/artifacts.

Secret findings receive additional defense in depth:

- exact start/end columns are removed
- local secret-derived `sfs1` fingerprints are not uploaded
- hosted secret fingerprints are re-keyed from reviewed rule/version plus repository-relative path and line only
- scanner-provided secret evidence summaries are not trusted; hosted summaries are regenerated from reviewed rule metadata

### Trusted hosted import

`lib/phase3-import` validates a closed Phase 3 source registry and accepts only reviewed scanner/rule/version combinations. The server reconstructs the canonical payload before accepting its `runRef` and rejects extra fields, traversal/absolute paths, unsupported sources, malformed repository URLs, oversized structures, and conflicting run identities.

The upload route accepts only:

- authenticated server-derived actor/workspace/role context
- one selected `assetId`
- `application/json`
- at most 3.5 MB, enforced both from declared length and while streaming

It cannot receive arbitrary lifecycle, source, URL, HTTP headers/body, budget, command, package-manager, repository checkout, or runtime-network configuration.

### Canonical persistence

Phase 5C reuses the existing repository asset model and canonical Phase 5A ledger. It does not create a parallel finding model and does not mark repository assets verified.

Production now contains:

- `phase3_import` scan job kind
- immutable `security_phase3_import_runs`
- service-role-only `persist_phase3_import_result(...)`
- three Phase 5C foreign-key covering indexes

The persistence RPC independently re-checks actor membership/role and exact repository asset binding, admits only deterministic passive scanner provenance and static/dependency evidence, serializes duplicate `runRef` imports with an advisory transaction lock, makes exact retries idempotent, rejects conflicting identity reuse, appends occurrences/events, and never treats absence from a later static scan as proof of a fix.

### Repository and findings UX

Repository asset detail pages now expose the hosted import command, privacy disclosure, JSON upload, and a bounded 20-row import history. Runtime and active-validation controls remain unavailable for repository assets.

The canonical findings list is paginated at 100 rows with one-row lookahead and deterministic `last_seen_at` plus `finding_id` ordering so large imports with identical observation timestamps cannot skip or duplicate records between pages.

### Executable architecture boundary

Phase 5C dependency guards forbid trusted import modules from acquiring runtime packages, scanner filesystem/inventory/coordinator execution, child processes, filesystem/network/socket/HTTP/TLS/VM/worker authority, direct fetch, repository checkout, package-manager installation, model-provider imports, or advisory inference authority.

## Production database state

The hosted ScopeForge Supabase project contains:

- `20260825210845 phase_5c_phase3_import_enum`
- `20260825211003 phase_5c_phase3_import`
- `20260825211239 phase_5c_phase3_import_fk_indexes`

Post-deployment verification confirmed:

- `phase3_import` exists in `scan_job_kind`
- `security_phase3_import_runs` has RLS enabled
- authenticated has SELECT but no INSERT/UPDATE/DELETE
- anon has no table access
- `persist_phase3_import_result` is `SECURITY DEFINER`
- its search path is pinned empty
- only `service_role` can execute it
- the terminal repository-import scan-job constraint is validated
- immutable update/delete triggers are enabled
- unique run and scan-job constraints plus composite asset/job foreign keys are present
- all Phase 5C foreign keys have covering indexes
- the import table is currently smoke-readable with zero rows
- Supabase security advisor is clean
- Supabase performance advisor has no missing-foreign-key-index notices; remaining notices are INFO-level unused indexes expected on a new/low-traffic database
- live-generated Supabase TypeScript types confirm the Phase 5C enum, table, and RPC shapes used by the application contract

## Verification note while GitHub Actions quota is exhausted

The repository exhausted its GitHub Actions allowance during PR #37. The user explicitly directed that ScopeForge development continue without triggering, rerunning, or depending on GitHub Actions for the remainder of the month. Subsequent commits therefore use `[skip ci]`.

Earlier Phase 5C checkpoints were executed before the quota blocker, including full-green Task 3 and Task 4 checkpoints. CI #720 later passed all 156 test files / 701 tests, strict typecheck, CLI build/version smoke, and scanner benchmark, then exposed a Next.js route-export issue during production build. That specific issue was corrected by moving the transport constant outside the route module. Later exact-head Actions runs did not execute repository steps because the monthly runner allowance was exhausted.

Do not describe the final PR #37 head as exact-head CI green. Final acceptance instead relies on targeted code/security review, the existing pre-quota executable checkpoints, live Supabase contract verification/advisors, live type generation, and additional local compiler/static checks where available.

## Next boundary

After PR #37 is merged and its final merge SHA is reconciled into the handoff docs, the next major product boundary is **Phase 6 isolated workers and scanner scale**: queue-backed workers, leases, dedicated egress, concurrency/backpressure, CPU/memory/time budgets, cancellation, private artifacts, fleet operations, and abuse controls.

Phase 6 must reuse the existing scanner, target, authorization, evidence, finding, and audit contracts without widening browser or runtime authority.