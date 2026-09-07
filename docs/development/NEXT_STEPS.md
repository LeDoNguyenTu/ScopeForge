# ScopeForge Next Steps

Last reconciled: 2026-09-08 (Asia/Singapore)

## Completed non-UI phases

- Phase 7 Community Security Packs v1: complete, PR #54 merged.
- Phase 8A offline accuracy foundation: complete, PR #55 merged.
- Phase 8B scanner performance matrix: complete, PR #56 merged.
- Phase 8C reproducible technical publication: complete, PR #57 merged.
- Phase 9A authentication boundary hardening: complete, PR #58 merged as `5c08003c8bf8cb920832431a346c9254aae92239`.

Do not recreate completed Phase 7, Phase 8, or Phase 9A work.

## Phase 9A release reference

- merged PR: #58
- final verified PR head: `386308657bca0d8ba66f86074992d9983db600ba`
- verified tree: `6c62f5223269597171bdb5caa39f647b4106a03f`
- final PR CI #767: success
- squash merge: `5c08003c8bf8cb920832431a346c9254aae92239`
- post-merge main CI #768: success
- exact production deployment: `dpl_BePDHoKDzWPXU6L2PX3Rj8bpTTue`, READY on the merge SHA with `aliasError=null`
- release state: `docs/development/PHASE_9A_RELEASE_STATE.md`

Phase 9A changed application authentication boundaries only. It did not enable provider hardening, change database privileges, or authorize hosted workers.

## Immediate non-UI priority - Phase 9C database/RPC defense-in-depth

Begin Phase 9C from the released Phase 9A baseline.

The first Phase 9C work must be evidence-driven and read-only where possible:

1. Inventory live schema usage, table grants, function ACLs, function kinds, `SECURITY DEFINER` status, search paths, and caller roles.
2. Reconcile that live state against committed forward-only migration history.
3. Add regression tests proving ordinary `anon` and `authenticated` clients cannot access private worker tables or execute worker-control RPCs.
4. Preserve the RLS dependency on `private.is_workspace_member` and `private.has_workspace_role` unless a reviewed replacement is proven first.
5. Identify private trigger/helper functions that retain unnecessary default `PUBLIC EXECUTE` privileges.
6. If privilege reduction is justified, implement it only through a new forward-only migration, with explicit grants retained for required RLS helper functions.
7. Verify any DDL change with focused tests, Supabase Security Advisor, exact privilege queries, full project verification, preview, frozen CI candidate, and post-merge validation.

Do not solve Phase 9C by blindly revoking `USAGE ON SCHEMA private FROM authenticated`. That would break the current RLS helper model unless replaced safely.

## Phase 9B remains separate

Do not enable these merely because Phase 9A is released:

- Supabase leaked-password protection
- Supabase Auth rate-limit configuration changes
- Cloudflare Turnstile
- Vercel WAF/rate-limit rules

The live Supabase Security Advisor currently still reports `auth_leaked_password_protection`. Phase 9B/provider hardening requires its own operational acceptance and rollback evidence.

## Later Phase 9 boundaries

After Phase 9C:

- Phase 9B provider/edge abuse controls when its operational prerequisites are ready
- Phase 9D security telemetry, alerting, and staged browser hardening
- Phase 9E incident response, credential rotation, release-security, rollback, and public-launch acceptance

Sequence may be adjusted only if evidence shows a more urgent security dependency. Do not mix unrelated subphases into one release candidate.

## Separate production worker acceptance

Code-complete is not production-enabled. Keep these false/absent until their own operational gates pass:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Do not infer Phase 8 validation or Phase 9 hardening authorizes any production worker.

## UI isolation

PR #49 and all active Dashboard V5/UI branches remain separate. Do not edit, merge, replace, retarget, or deploy that stream from the non-UI hardening workstream.

## Branch cleanup

Delete merged backend branches only with a true remote delete-ref mutation. Never force-move a merged branch to simulate deletion. Preserve PR #49 and all active V5/UI branches.
