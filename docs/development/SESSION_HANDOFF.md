# ScopeForge Session Handoff

## Current phase
Phase 3A - Scanner Foundation implemented on PR #6, pending final PR validation and merge

## Last completed work
- Phase 1 foundation is merged to `main`.
- Phase 2 Asset Control is merged to `main` through PR #4.
- The Phase 3 code and supply-chain security design is approved and merged through PR #5.
- PR #6 implements the first contract-first Phase 3 slice: finding contracts, stable fingerprints, bounded repository inventory, scanner coordination, deterministic deduplication, scanner error capture, severity helpers, and native ScopeForge JSON serialization.
- The Phase 3A implementation was developed test-first. CI run #68 established the initial RED state because the planned scanner modules did not exist. CI run #69 passed after the minimal implementation was added.
- Final security review identified that the accepted-file limit did not stop remaining sibling traversal. CI run #72 reproduced the issue with a dedicated regression test, and CI run #73 passed after traversal was stopped at the file-count budget.
- Contract review then identified incomplete `**` ignore semantics. CI run #75 reproduced the zero-directory mismatch, and CI run #76 passed after `**/` was implemented as zero-or-more directory segments and trailing `/**` was made subtree-aware.
- `docs/SECURITY.md` now records the Phase 2 control-plane boundary and Phase 3 local hostile-repository guarantees.

## Production resources
- Domain: `scopeforge.dev`
- Supabase project: `tdgpibrepzcvdivztkta`
- Supabase region: `ap-southeast-1`
- GitHub repository: `LeDoNguyenTu/ScopeForge`

## Current architecture
Control plane: Next.js/Vercel
Structured data and auth: Supabase
Local scanner core: framework-independent TypeScript under `packages/scanner-core`
Local scanner outputs: framework-independent TypeScript under `packages/scanner-output`
Hosted artifact persistence: deferred until the local scanner contract is stable
Remote scanner execution plane: not enabled

## Phase 3A trust boundary
- Scanner-core packages do not depend on Next.js, Supabase, or Vercel.
- Repository inventory uses `lstat` and does not follow symlinks.
- Generated/vendor paths are excluded by default.
- Root `.scopeforgeignore` and `.gitignore` are honored by bounded matching logic.
- Ignore matching supports comments, blank lines, leading `/`, trailing `/`, `*`, `**`, and `?`; negation is not used to re-include paths in this bounded first implementation.
- File-count, per-file byte, and total-byte budgets are enforced.
- Reaching the accepted-file budget stops remaining traversal instead of continuing through the repository.
- Scanners receive one shared repository inventory instead of walking the repository independently.
- Scanner failures are represented as explicit scan errors rather than a false clean result.
- Finding fingerprints use structural identity and do not accept raw secret values.
- Native JSON findings are deterministically ordered.
- No repository code, package lifecycle script, Dockerfile, Terraform configuration, Kubernetes manifest, or workflow is executed.
- No remote scanning, exploitation, credential attack, persistence, or destructive behavior is introduced.

## Database migrations applied
- `20260823180002_phase_1_identity_and_workspaces`
- `20260823180018_phase_1_optimize_rls`
- `20260823184845_phase_2_asset_control`
- `20260823184906_phase_2_audit_rls_fix`
- `20260823184920_phase_2_foreign_key_indexes`
- `20260823185412_phase_2_verification_guards`
- `20260823191828_phase_2_harden_write_boundary_and_verification`
- `20260823192253_phase_2_enforce_verification_quotas`
- `20260823192740_phase_2_index_composite_foreign_keys`

## Verification status
- CI run #76 on ignore-semantics hardening commit `82a9074b8febbdccb60ccb1c0726c299ae9d00d2`: passing.
- Vitest: 13 test files and 72 tests passed.
- Phase 3A scanner tests: finding fingerprints, severity ordering, bounded inventory, traversal-stop behavior, zero-or-more `**` ignore semantics, coordinator deduplication/error capture, and deterministic JSON passed.
- TypeScript strict typecheck: passing.
- Next.js production build: passing.
- Phase 3A has no database migration or Supabase policy change, so the Phase 2 database security boundary is unchanged.
- The final PR #6 head after this documentation update must pass CI before merge.

## Known limitations
- Phase 3A establishes contracts and safety boundaries only. It does not yet ship detector rules.
- No CLI command is exposed yet.
- Configuration and explicit policy gating are not implemented yet.
- A shared safe content-read helper for inventory entries is not implemented yet; this must be added before detector families read repository files so they do not bypass root/symlink/size boundaries.
- Secret scanning and redaction are not implemented yet.
- JS/TS AST SAST and taint analysis are not implemented yet.
- Dependency/OSV analysis and CycloneDX SBOM generation are not implemented yet.
- Docker, Kubernetes, Terraform, GitHub Actions, and generic configuration rules are not implemented yet.
- Baselines and SARIF are not implemented yet.
- Remote DAST and active exploitation remain explicitly outside Phase 3.

## Active pull request
PR #6 - `Build Phase 3A scanner foundation`

## Next action
1. Confirm CI is green on the final PR #6 head after these handoff updates.
2. Confirm no Critical or Important review findings remain.
3. Mark PR #6 ready and squash merge it into `main` when all gates are green.
4. Begin Phase 3B with a safe inventory content-read helper, configuration, policy-gate semantics, and the local CLI shell using the Phase 3A contracts.

## Resume protocol
1. Read this file.
2. Read `CURRENT_STATE.md`.
3. Read `docs/superpowers/specs/2026-08-24-phase-3-code-supply-chain-design.md`.
4. Read the current Phase 3 implementation plan.
5. Inspect only files required by the next action unless a dependency requires more context.
6. Update this handoff before ending a development session that changes scanner behavior or security boundaries.
