# ScopeForge Next Steps

## Current boundary - Phase 6C isolated zero-egress scanner execution

Phase 6B public GitHub repository acquisition and immutable private source snapshots is complete and merged through PR #38.

- reviewed feature head: `6a999df6bbb849e5eb698dbc387f7ec2a82df6d6`
- merge commit: `79c5ac30c38e91081a7bd6256e2b77f2a0cb25dc`
- ScopeForge Supabase project: `tdgpibrepzcvdivztkta`
- live schema reconciled through `20260826224847 phase_6b_repository_snapshot_live_hardening`

Phase 6B established a closed snapshot producer. Phase 6C must consume those immutable snapshots without inheriting acquisition authority.

## Phase 6B invariants to preserve

- repository identity derives only from the stored canonical asset
- default branch is resolved to an immutable commit SHA before archive download
- acquisition networking is limited to GitHub API, one reviewed codeload redirect, and one attempt-specific R2 PUT
- R2 PUT is create-only using signed `If-None-Match: *`
- public snapshot provenance is immutable and member-readable only
- service_role has no direct snapshot-table authority
- publication is exact-lease and dedicated-RPC-only
- cancellation wins before publication
- private object keys and source artifacts do not reach browser code
- Phase 5C hosted import remains data ingestion only
- Phase 6A foundation workers remain zero-egress and free of GitHub/R2 authority

## Phase 6C required properties

Phase 6C should consume the immutable Phase 6B snapshot as a private scanner input while preserving deterministic Phase 3 semantics.

1. Scanner execution receives only a broker-selected immutable snapshot and a closed scan profile.
2. No GitHub/R2 acquisition credential, presigned PUT, arbitrary object key, URL, branch, SHA, scanner list, command, environment, or execution budget may come from the worker caller.
3. The scanner executor has zero target/network egress.
4. Repository code is data only. No package lifecycle script, build tool, package manager, Git hook, container definition, IaC tool, project command, dynamic target import, VM, or worker-spawned target execution is allowed.
5. Snapshot materialization must be path-safe, bounded, isolated from the host filesystem, and verified against immutable provenance before scan use.
6. CPU, memory, process, input, scratch, output, and wall-time limits must be enforceable by the concrete sandbox adapter, not just reported as advisory metrics.
7. Cancellation and the supervisor hard deadline must terminate underlying sandbox resources.
8. The Phase 3 scanner profile must be fixed and versioned. Callers cannot select individual scanners or weaken hostile-repository safety.
9. Scanner outputs must pass the existing deterministic normalization/validation boundary before hosted findings can change.
10. Absence from a scan must not automatically mean `verified_fixed`.
11. Model/advisory output remains downstream and cannot independently change authoritative validation or lifecycle state.
12. Phase 6C must not gain generic HTTP, runtime-observer, runtime-validator, GitHub acquisition, or R2 upload authority.

## Design work before implementation

Before Phase 6C code:

1. Threat-model snapshot consumption, sandbox escape, resource exhaustion, archive/path attacks, scanner parser attacks, stale/deleted snapshot races, cancellation races, output spoofing, and cross-workspace binding.
2. Select the concrete isolation adapter and define exactly which limits it can enforce.
3. Define a new closed execution class and immutable worker contract.
4. Define server-side snapshot retrieval/materialization authority without exposing object keys or long-lived R2 credentials to the scanner executor.
5. Define artifact integrity verification before scanning, including expected size/digest/provenance checks.
6. Define Phase 3 scanner invocation as direct trusted library calls, not shell/package/project execution.
7. Define terminal result schema, size bounds, deterministic serialization, and trusted persistence path.
8. Define retry, cancellation, deadline, cleanup, and stale-snapshot semantics.
9. Add permanent architecture guards before broad implementation.
10. Use RED then minimal GREEN checkpoints for each authority boundary.

## Verification constraint

Do not use GitHub Actions. The monthly allowance is exhausted and no workflow should be triggered or rerun.

Continue using `[skip ci]` for implementation and documentation commits while that restriction remains active.

The current execution environment cannot resolve `github.com` and has no dependency-complete checkout. Do not claim these checks are green unless a runnable environment later executes them:

```text
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

## Later Phase 6 boundary

Dedicated network-enabled runtime/active worker execution remains separately reviewed after zero-egress scanning is demonstrated. Phase 6B GitHub networking must not be reused as a shortcut for general worker egress.

## Resume protocol

1. Read `SESSION_HANDOFF.md`, `CURRENT_STATE.md`, `TEST_STATUS.md`, and this file.
2. Read `docs/ARCHITECTURE.md` and `docs/PHASES.md`.
3. Re-check exact `main` and active branch heads plus production migration history.
4. Never edit deployed Phase 6B migration history; use forward migrations only.
5. Preserve create-only R2 upload, cancellation-first publication, RPC-only snapshot mutation, private-table isolation, and Phase 5C/6A authority separation.
6. Begin Phase 6C with an explicit threat model and approved design before scanner execution implementation.
