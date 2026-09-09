# ScopeForge Current State

Last reconciled: 2026-09-09 (Asia/Singapore)

## Released baseline

- repository: `LeDoNguyenTu/ScopeForge`
- current released `main`: `6c6c07b070d2751a96729d3e58a86414ae148edc`
- current released tree: `91bbc94f5c3c00050da21a4b5288bc17b0847540`
- latest implementation PR: #64, Phase 9E incident readiness and release engineering
- frozen candidate CI: #781, success
- post-merge main CI: #782, success
- production deployment: `dpl_5sQid6VJ4xC2BS7iYrHBYUrzzQFP`, READY, `aliasError=null`
- production domain: `scopeforge.dev`

The released `main` tree is the integration baseline for future work.

## Completed phases

Released work now includes:

- Phases 1 through 6D
- Phase 7 Community Security Packs v1
- Phase 8A offline accuracy foundation
- Phase 8B deterministic scanner performance matrix
- Phase 8C reproducible technical publication
- Phase 9A authentication-boundary hardening
- Phase 9B provider/auth hardening code
- Phase 9C database/RPC defense-in-depth
- Phase 9D security telemetry and browser hardening
- Phase 9E incident readiness and release engineering

## Phase 9E release evidence

Phase 9E released through PR #64.

- exact candidate: `887325d13900b2f7653d81b78a3013d887ac4508`
- candidate tree: `91bbc94f5c3c00050da21a4b5288bc17b0847540`
- candidate Preview: `dpl_mn4BFJNJCmyZnF6JehU1Lp9sGQeD`, READY
- candidate CI #781: success
- squash merge: `6c6c07b070d2751a96729d3e58a86414ae148edc`
- post-merge main CI #782: success
- production deployment: `dpl_5sQid6VJ4xC2BS7iYrHBYUrzzQFP`, READY
- release record: `docs/development/PHASE_9E_RELEASE_STATE.md`

## Production UI

The accepted Command Center UI V5 remains the production UI.

Fresh post-release checks confirm:

- `scopeforge.dev` returns HTTP 200
- desktop V5 marker is present
- mobile V5 marker is present
- desktop V5 poster asset is present
- mobile V5 poster asset is present

Historical V4, preview, diagnostic, and reconciliation branches are not implementation baselines.

## Browser baseline

The current response retains the released security-header baseline. CSP is not currently enforced.

Strict CSP compatibility is the next separate engineering gate. It must be tested against the exact current Next.js and V5 behavior before enforcement.

## Supabase baseline

- ScopeForge project: `tdgpibrepzcvdivztkta`
- status: `ACTIVE_HEALTHY`
- migration head: `20260908084554_phase_9c_function_acl_hardening`
- current Security Advisor still reports leaked-password protection disabled

Phase 9E introduced no database migration.

## Provider truth

Current conservative state:

- production Turnstile provider enforcement: `NOT VERIFIED`
- Vercel custom WAF/rate-limit rule state: `NOT VERIFIED`
- Supabase leaked-password protection: `VERIFIED DISABLED`
- CSP: `NOT ENFORCED`

Provider state is never inferred from repository source.

## Branch hygiene

Historical completed diagnostic, preview, reconciliation, documentation, and feature branches are cleanup candidates.

The connected GitHub write surface currently does not expose a genuine branch-deletion operation, and repository `delete_branch_on_merge` is false. Stale refs must not be disguised as deleted by moving them to `main`.

## Next engineering boundary

The next implementation boundary is strict CSP compatibility against the exact released production tree, followed by the normal exact-head release gates.

## Production services

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- Vercel project: `scopeforge`
- production: `scopeforge.dev`
