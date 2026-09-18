# ScopeForge Codex handoff

Last reconciled: 2026-09-18, Asia/Singapore. Live GitHub and provider evidence wins.

## Current resume point

- Released `main`: `aaada713296ec70f0a6497b4828939bc6b88e7fb` (PR #134).
- PR #134 adds the second deterministic Task 11 fixture: labeled finding accuracy, provenance-backed attack-path, remediation-retest, duplicate-correlation, reproducibility, and fixture-safety evidence.
- Exact PR-head CI `35351118308` passed for `1cdf4cf73eba4423ccca7d36cc8c795bae557cf6`.
- Post-merge main CI `35351673275` passed for `aaada713...`.
- Vercel production GitHub deployment `6525534937` succeeded for that exact merge SHA. Its deployment URL is `https://scopeforge-kgih0ypyl-itsbrian.vercel.app`; the normal production diagnostic also passed against `scopeforge.dev` in CI.

## Task 11 evidence now released

- A committed four-label, injected-provider-only fixture yields 2 TP, 0 FN, 1 FP, and 1 TN: precision `2/3`, recall `1`, false-positive rate `1/2`, and F1 `4/5`.
- It measures a validated-finding rate of `2/3`, one duplicate correlation key among four raw reports (`1/4`), the expected evidence-backed `entrypoint -> API -> data` path, and two correct synthetic remediation retests (`1`).
- The benchmark completed in 1.616 seconds under its five-second catastrophic ceiling. The full local suite passed: 463 files passed, 4 skipped; 2,108 tests passed, 24 skipped.
- Exact PR and merged-main CI both passed audit, full tests, typecheck, CLI/version, scanner benchmarks, Next build, Linux CSP/responsive browser smoke, and the production UI/Turnstile diagnostic.

## Next implementation

Continue Task 11 with deterministic graph-expansion and policy/approval fixture coverage. Keep the harness synthetic, fixture-driven, auditable, and injected-provider-only. Do not use current fixture metrics as global product accuracy.

## Release and provider boundary

- Issue #79 is CLOSED. PR #76 (Phase 10A2) and PR #77 (Phase 10A3) are both merged and released; their historical handoff branches are not active work.
- ScopeForge Supabase is `tdgpibrepzcvdivztkta`. Phase 11 migrations remain source-only and unapplied; Phase 11 tables remain absent from production.
- External Phase 11 provider execution remains disabled. Do not apply migrations, widen hosted authority, expose secrets, weaken authorization/RLS/containment, or confuse this project with `xwsergbpvkcsugexssmc`.
