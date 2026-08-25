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

Coverage verifies viewer rejection, member self-assignment only, owner/admin assignment to current workspace members, invalid-assignee rejection, the 2000-character note bound, safe errors, append-only assignment/note events, independent database role checks, and service-role-only mutation authority.

### Retest request and execution

Coverage verifies only resolved supported findings may enter retest, the source registry is closed to passive runtime and `cors-origin-policy@1`, active consent/owner-admin authority are required, snapshots are immutable, only one retest may be active, and `resolved -> retest_pending` is atomic with history.

Execution coverage proves the existing passive/active runtime services and fixed budgets are reused, job attachment is exact and one-way, enqueue failure can safely abort an unstarted retest, and callers never choose a desired terminal result.

### Authoritative finalization

Coverage verifies exact job/workspace/asset/requester/profile binding. Successful recurrence becomes `still_present`; only a successful exact-source/profile job with no target occurrence and canonical lifecycle still pending can become `verified_fixed`. Failed, blocked, cancelled, snapshot-mismatched, or stale retests cannot verify a fix, and non-verified terminal outcomes recover a still-pending finding to `in_progress`.

### Deterministic Security Story v1

Coverage verifies evidence provenance, bounded evidence presentation, no raw-response fields, remediation state integration, and verified-fixed wording only when canonical lifecycle and latest authoritative retest agree. Story construction remains pure and provider/framework/runtime independent.

### Architecture and authority guards

CI enforces that remediation cannot import generic runtime-network authority, runtime packages cannot import remediation, Security Story is infrastructure/provider independent, browser roles remain read-only, Phase 5B mutation RPCs remain service-role-only, and no generic request/credential/raw-response storage fields enter the workflow schema.

## Production database verification

Phase 5B production deployment completed successfully.

Production migration history now contains:

- `20260825170915 phase_5b_remediation_retest_security_story`
- `20260825170933 phase_5b_retest_recovery_hardening`

Post-deployment SQL verification confirmed:

- both Phase 5B workflow tables exist
- RLS is enabled on both
- authenticated has SELECT but no INSERT, UPDATE, or DELETE
- anon has no table access
- all five mutation RPCs are `SECURITY DEFINER`
- all five mutation RPCs have `search_path = ''`
- `public`, `anon`, and `authenticated` have no EXECUTE privilege
- `service_role` has EXECUTE privilege
- source/execution/timestamp constraints are present
- immutable-snapshot and unverified-retest recovery triggers are present
- all four intended Phase 5A foreign-key covering indexes are present
- smoke reads succeed on both new tables

Post-deployment Supabase advisor state:

- security advisor: clean
- performance advisor: no missing-foreign-key-index notices
- remaining notices are INFO-level unused indexes, expected while the database and Phase 5B tables have little or no traffic

The generic unused-index advisory reference is: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

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
