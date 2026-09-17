# PR #77 Phase 10A3 Release Acceptance

Last refreshed: 2026-09-18, Asia/Singapore.

## Candidate

- Branch: `feat/phase-10a3-github-webhook-reconciliation`
- Source-fix commit: `37c3e68a6e188b30a1c23399449cc794fa776335`
- Base/released `main`: `327b06d150f24d4cb3161cac078198ae0d473613`
- PR: #77, open/ready and mergeable before this documentation update
- Exact-source CI: run `35286439598`, passed
- Exact-source Vercel check: passed
- Production deployment: `dpl_HkfuaAJ33qY8cs3xbWJFAPKqRTzV`, READY and aliased to `scopeforge.dev`

## Release-blocking defect and fix

The private rapid-push canary reached the newest head `f13f3d72d0782e4260898201d8dd2f08885a8088`, but the connected project stayed `retry_pending`. Using **Resume project scan** created another same-head scan and the automatic state still did not settle.

Live inspection showed the successful watermark was null while the desired head was `f13f3d72...`. Both repository-scan finalize routes invoked `reconcileConnectedProjectScanTerminal` before `reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal`. Generic cleanup cleared the exact intent/task identifiers before the automatic/manual-aware settlement could record success. Recovery then treated the same head as still pending and could reacquire it.

TDD evidence:

- RED: `tests/project-scans/manual-auto-followup.test.ts` failed twice, once for each finalize route, because generic cleanup preceded automatic settlement and its retry guard.
- GREEN: automatic/manual-aware settlement now runs first; retry-required results throw before generic cleanup; focused recovery/reconciliation suites passed 33 tests.
- Full suite: 437 files passed, 4 skipped; 1,996 tests passed, 24 skipped.

No migration was required. Existing forward-only Phase 10A3 functions already implement exact task/job/snapshot/commit settlement; the route call order was wrong.

## Validation

- Node `24.16.0`
- `npm audit --audit-level=info`: zero vulnerabilities
- typecheck: passed
- CLI build and `ScopeForge 0.1.0`: passed
- worker build: passed
- scanner benchmark: 700 files, zero findings/errors, 1,070 ms wall under 20,000 ms
- benchmark matrix: all dependency, IaC, and source profiles passed all three runs and ceilings
- Next production build: passed, 8/8 static pages
- exact-source GitHub CI included Linux build, CSP browser smoke, and production UI diagnostic: passed
- Codex Security diff scan `7231ee4e-2c72-4014-8f8f-15b055638982`: complete, zero findings; generated `next-env.d.ts` drift was restored before commit
- GitNexus pre-edit impact: LOW for each route; pre-commit change detection identified only the two worker `POST` entry points across ten worker flows, which were covered by focused and full tests

## Production recovery acceptance

Before the accepted resume:

- project state: `retry_pending`
- automatic state: `pending=true`, desired `f13f3d72...`, successful watermark null
- exact-head source snapshots: 3
- exact-head successful scans: 2

After deploying `37c3e68a...`, the authenticated production UI resumed the existing published snapshot once. The result was:

- project state: `idle`
- automatic state: `pending=false`
- desired and successful SHA: `f13f3d72d0782e4260898201d8dd2f08885a8088`
- outcome: `SCAN_SUCCEEDED`
- intent state: `idle`; snapshot/task identifiers cleared; no error
- exact-head source snapshots remained **3** (no reacquisition)
- exact-head successful scans became **3**
- UI returned from **Scan queued** to **Scan project**, removed the retry message, and displayed the newest successful run (`sfh1:1d5717f03d391...`, 3 files, 533 B, one expected finding, 46 ms)

This proves same-head recovery, exact-snapshot reuse, successful-watermark settlement, and no duplicate acquisition for the repaired candidate.

## Remaining release steps

1. Commit and push this documentation checkpoint.
2. Require exact-head CI and Vercel success.
3. Merge PR #77 normally.
4. Verify merged `main`, main CI, production deployment, live state, and authenticated browser behavior.
5. Reconcile PR #124 only after PR #77 is released.
