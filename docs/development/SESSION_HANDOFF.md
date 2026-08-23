# ScopeForge Session Handoff

## Current phase
Phase 2 - Asset Control complete, pending merge/release validation

## Last completed work
- Phase 1 foundation merged to `main`.
- Community platform design approved and merged.
- Phase 2 implementation plan approved and merged.
- PR #4 implements asset registration, proof-of-control verification, quotas, auditability, live asset UX, and dashboard integration.
- Final Phase 2 security review hardened direct-write boundaries, verification challenge lifecycle, database quotas, composite workspace constraints, and DNS-rebinding protection.

## Production resources
- Domain: `scopeforge.dev`
- Supabase project: `tdgpibrepzcvdivztkta`
- Supabase region: `ap-southeast-1`
- GitHub repository: `LeDoNguyenTu/ScopeForge`

## Current architecture
Control plane: Next.js/Vercel
Structured data and auth: Supabase
Artifact storage: Cloudflare R2 planned for Phase 3
Scanner execution plane: not enabled yet

## Phase 2 trust boundary
- Authenticated browser clients have RLS-scoped SELECT access to Phase 2 records.
- Direct authenticated writes to Phase 2 security tables are revoked.
- Server actions resolve the authenticated user, workspace, and role before trusted writes.
- Owner, admin, and member roles can manage assets. Viewer cannot.
- Hosted verification uses HTTPS port 443, public-address validation, IP-pinned HTTPS requests, manual redirects, a 5-second timeout, and a 4 KiB response ceiling.
- Active scanning remains disabled.

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
- Phase 2 unit tests: passing at the final implementation checkpoint.
- TypeScript typecheck: passing at the final implementation checkpoint.
- Next.js production build: passing at the final implementation checkpoint.
- Supabase security advisor: no lints.
- Supabase performance advisor: only expected unused-index INFO notices after adding the required composite FK indexes.
- Cross-workspace RLS check: passed.
- Direct authenticated Phase 2 INSERT/UPDATE/DELETE checks: denied as designed.
- The final PR head must pass CI before merge.

## Known limitations
- No active scanners are enabled.
- Repository proof-of-control is not implemented yet.
- Hosted verification supports HTTPS port 443 only.
- Production asset mutations require server-side `SUPABASE_SECRET_KEY` configuration.
- R2 artifact storage begins in Phase 3.

## Active pull request
PR #4 - `Build Phase 2 asset control`

## Next action
1. Confirm the final PR #4 head passes unit tests, typecheck, and production build.
2. Mark PR #4 ready and squash merge it into `main`.
3. Reset the working branch to the squash commit to keep public branch history concise.
4. Begin Phase 3 design for code security only after Phase 2 is merged.

## Resume protocol
1. Read this file.
2. Read `CURRENT_STATE.md`.
3. Read the current phase plan or next-phase design.
4. Inspect only files required by the next action unless a dependency requires more context.
5. Update this handoff before ending a development session that changes product behavior or security boundaries.
