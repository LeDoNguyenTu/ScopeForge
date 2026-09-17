# Phase 10A2 Private Repository Acquisition Working State

Last reconciled: 2026-09-17, Asia/Singapore.

## Status

Operational acceptance: PASSED. PR #76 remains draft only for final documentation and exact-head CI. Executable head: `e8d47e4a42ac97b3eabfb41a884555fe24ef93ec`.

## Production evidence

- Vercel: `dpl_B3sfM7kVZubuBqGBkw3WtB4wJMk1`, READY.
- Worker release: `2e640e8929f6f7da579d7904a6d49532ec055c5d`.
- Scanner: `localhost/scopeforge-scanner@sha256:07be9bee8d3a0803a107042de8ea3ca2ab41b5496aa28e21d9ea0e42bcdc76ce`.
- Workers `96823db9-b35f-4bde-a857-0b9b97d761de` and `e12db837-8e21-4dde-af92-984431fe3a89`: enabled/active.
- Runtime directory persists; no containers or task work directories remain.
- Three repository gates remain enabled after acceptance.

## Private canary

- Repository/commit: `LeDoNguyenTu/scopeforge-private-canary@d95ca07123e28ee64de799e87651c2a3b6edb5cf`.
- Task/job/run: `58601082-a4a1-428e-8383-ff8d0fba21e6` / `f4d2cd32-5339-43f0-8188-69ecfa0494bb` / `024e283b-353c-485d-b3ed-36f4e68bc1f7`.
- Result: 539 ms, 2 files, 475 bytes, 1 finding, zero scanner errors.
- Finding: high/high `jsts/command-injection`, CWE-78, `src/canary.ts:10`, `static_confirmed`.

Provider membership came from the legitimate GitHub App flow. No state was fabricated.

## Recovery, UI, and validation

- Terminal and expired-attempt recovery were exercised; successful publication returns the project to `idle`.
- Production UI shows one `Scan project` action, scan history, the finding ledger, and full detail; encoded IDs resolve correctly.
- Full suite: 425 files passed, 4 skipped; 1,869 tests passed, 24 skipped.
- Audit, typecheck, CLI/worker/Next builds, benchmarks, migrations/advisors, worker health/cleanup, headers, Vercel, and browser acceptance passed.

Next: commit docs, mark #76 ready, require exact-head CI, merge, and verify main/production. Keep #77 unreleased until then.
