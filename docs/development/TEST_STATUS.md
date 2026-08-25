# ScopeForge Test Status

## Current Phase 5B baseline

Phase 5B exact PR head `5c7b8c34432f8bb51731fe069178411a8005d023` passed CI #685 before PR #33 was merged with expected-head protection as `eb35c2b23468addd817951486c60ac7d68710c9a`.

| Check | Result | Evidence |
|---|---|---|
| Reproducible dependency install | Passing | `npm ci --ignore-scripts --no-audit --no-fund` |
| Vitest | Passing | 148 test files / 654 tests |
| TypeScript strict typecheck | Passing | `npm run typecheck` |
| CLI TypeScript build | Passing | `npm run build:cli` |
| Compiled CLI runtime smoke | Passing | `node .scopeforge-build/packages/cli/index.js version` -> `ScopeForge 0.1.0` |
| Scanner benchmark | Passing | 700 files, 0 errors, 1111 ms wall time against 20000 ms limit |
| Next.js production build | Passing | `npm run build` |

The PR security-sensitive diff was reviewed before merge. No merge-blocking security issue remained at the exact reviewed head.

## Phase 5B TDD and regression coverage

### Remediation work

Coverage verifies:

- viewer rejection
- member self-assignment only
- owner/admin assignment to current workspace members
- invalid assignee rejection
- 2000-character remediation-note bound
- safe error mapping
- assignment and remediation-note events
- independent database membership and role checks
- service-role-only mutation RPC execution

### Retest request

Coverage verifies:

- only resolved findings may enter retest
- unsupported source rejection
- closed source registry for passive runtime and active CORS only
- active explicit-consent requirement
- active owner/admin requirement
- passive member acceptance
- immutable source/profile snapshot
- one active retest per finding
- atomic lifecycle/event state for `resolved -> retest_pending`

### Retest execution and recovery

Coverage verifies:

- passive retests reuse only the passive runtime service
- active retests reuse only the bounded active-validation service
- existing fixed runtime budgets are used
- mark-running occurs after enqueue and before execution
- finalization occurs after execution
- enqueue failure can abort an unstarted retest safely
- source snapshot constraints reject drift
- non-verified terminal outcomes recover a still-pending finding to `in_progress`

### Authoritative retest finalization

Coverage verifies:

- exact job/workspace/asset binding
- exact requester and job-kind binding
- active profile and authorization binding
- one-way running attachment
- successful exact-job recurrence -> `still_present`
- successful exact-source/profile job with no target occurrence and lifecycle still pending -> `verified_fixed`
- failed job -> `failed`
- blocked job -> `inconclusive`
- cancelled job -> `cancelled`
- snapshot mismatch cannot verify a fix
- concurrent recurrence/lifecycle drift prevents stale verified-fixed finalization
- callers cannot submit a desired terminal result

### Deterministic Security Story v1

Coverage verifies:

- evidence provenance labels
- bounded evidence presentation
- no raw-response fields
- current remediation assignment/note integration
- verified-fixed wording only when canonical lifecycle and latest authoritative retest agree
- story construction remains pure and provider/framework/runtime independent

### Read model and UI

Coverage verifies:

- workspace-scoped workflow reads
- retest history ordered and bounded to 50
- narrow server-action inputs
- no URL, method, header, body, source/profile, budget, scan-job, desired-result, or generic-lifecycle-target parameters
- remediation, retest, and Security Story component behavior

### Architecture and authority guards

CI enforces:

- remediation code cannot import generic `packages/runtime-network`
- runtime packages cannot import remediation workflow
- `story.ts` has no Supabase, Next.js, React, model-provider, or runtime execution dependency
- authenticated browser roles retain SELECT-only access to Phase 5B workflow tables
- Phase 5B mutation RPCs are `SECURITY DEFINER`, pin `search_path = ''`, are revoked from `public`, `anon`, and `authenticated`, and are granted only to `service_role`
- Phase 5B schema does not add raw response bodies, cookie values, authorization/credential storage, arbitrary request headers, caller URLs/methods/bodies, or other generic request authority
- all earlier Phase 1 through Phase 5A security and regression tests remain in the full suite

## Benchmark evidence

CI #685 scanner benchmark:

```text
fixture: scanner-medium-v1
filesAnalyzed: 700
findings: 0
errors: 0
scanDurationMs: 1023
wallMs: 1111
rssDeltaBytes: 31862784
maxWallMs: 20000
```

## Production database verification status

Application and repository verification is green, but the production Supabase migration history still ends at Phase 5A. The two Phase 5B migrations must be deployed and verified before hosted Phase 5B is considered production-ready.

Pre-deployment advisor state:

- security advisor: clean
- performance advisor: four INFO-level missing Phase 5A foreign-key covering indexes plus existing unused-index informational notices
- the first Phase 5B migration intentionally adds covering indexes for those four foreign keys

After production migration, rerun both advisors and verify RPC privileges and workflow-table RLS.

## Required merge gate for future code PRs

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js version
npm run benchmark:scanner
npm run build
```

Merge only when every command is green on the exact PR head and GitHub reports no blocking review state.
