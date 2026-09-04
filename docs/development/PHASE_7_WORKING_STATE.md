# Phase 7 Community Security Packs Working State

Last reconciled: 2026-09-04 (Asia/Singapore)

This is the resumable checkpoint for Phase 7 implementation PR #54 on `feat/phase-7-community-security-packs-v1`.

## Permanent safety boundary

Dashboard V5/UI remains out of scope and untouched. Security Packs are local-only, explicitly selected, data-only, `static_literal_v1` only, and cannot add dynamic execution, networking, active probing, browser authority, worker authority, package hooks, or target-repository auto-discovery. Phase 7 does not change Supabase, Vercel production behavior, hosted worker capabilities, or production feature flags.

## Completed verification boundaries

- Task 3: GREEN `43a938308e742a346055ac6e8d60996769275f91`, run `33818604589`
- Task 4: GREEN `30b9439ac431e8ccb738201ef9ab3c4a6674d26c`, run `33820356775`
- Task 5: final GREEN `a0c8fa1f58d22804e870d07c4a134357ad4d675a`, run `33821554251`
- Task 6 RED: `23348c2b031798e4d1ff3bbc66992bb7c9767a43`, run `33821933407`
- Task 6 initial GREEN run `33858389016` passed 1,274 tests, typecheck, and CLI compilation, then exposed a compiled CommonJS runtime alias in `finding.ts`.
- Task 6 portability repair: `057b56da324db53e6db18e292a555581b4e87061`
- Task 6 final GREEN: run `33858705622`

Fresh Task 6 verification passed 295 test files / 1,274 tests, typecheck, CLI compilation, compiled CLI version smoke, scanner benchmark, and production Next.js build.

Task 6 provides canonical privacy-safe pack inspection, pack validation, repeated explicit `scan --pack`, cwd-relative pack selection, a parser-level 10-pack ceiling, reserved built-in identities, no repository self-activation, pack-free baseline creation, CLI-level hosted-json rejection, and privacy-safe Security Pack errors.

## Task 7 - intentional RED gate

Task 7 test-only commits now define:

- `tests/security-packs/output.test.ts`
  - ordinary JSON/SARIF/terminal/baseline compatibility
  - deterministic output
  - no matcher literal, suppression literal, fixture source, or pack-path leakage
  - direct hosted serializer rejection of `security-pack` findings
- `tests/architecture/security-packs-dependencies.test.ts`
  - import-specifier-level offline/data-only dependency checks
  - no network/process/dynamic execution primitives
- `tests/architecture/security-packs-authority.test.ts`
  - explicit `--pack` remains the only activation path
  - no scan-target manifest discovery
  - hosted serializer must contain its own `security-pack` rejection
  - browser, hosted-runner, repository network, and runtime worker authority must remain independent from Security Packs

No Task 7 production serializer change has been made yet. This commit intentionally triggers the RED run. Expected failure is the missing direct hosted serializer rejection. Existing ordinary local serialization and dependency-boundary assertions should remain green.

## Remaining plan

- Task 7 output compatibility and permanent authority guards
- Task 8 first-party example pack and contributor/reviewer governance
- Task 9 full verification, security review, non-root Linux acceptance, release documentation, and final integration

Authoritative plan: `docs/superpowers/plans/2026-09-01-phase-7-community-security-packs.md`.
