# Phase 10C Platform Admin Console Working State

Date: 2026-09-10
Branch: `feat/phase-10c-platform-admin-console`
PR: #75
Status: implementation in progress, production database unchanged

## Completed in branch

- Dedicated platform administration boundary separate from workspace roles.
- `platform_admins`, `platform_admin_audit_events`, and singleton `platform_settings` forward migration.
- RLS enabled on platform tables with no browser mutation authority.
- Last-platform-owner database guard.
- Authoritative registration gate in `private.handle_new_user()` with explicit function execution revocation.
- Server-side platform admin authorization using the trusted Supabase client.
- Bounded platform user listing/search/detail normalization.
- Platform user workspace membership read model.
- Aggregate platform user/workspace/asset/scan/finding statistics.
- Guarded suspend and restore through Supabase Auth Admin APIs.
- Guarded hard deletion with exact fresh email confirmation, self/admin protection, shared-workspace refusal, and personal-workspace cleanup ordering.
- Platform mutation audit events with bounded reason and metadata fields.
- Platform settings service for registration and maintenance state.
- Maintenance-mode routing for the public landing page and authenticated tenant dashboard while keeping admin, auth, maintenance, and API surfaces reachable.
- Registration page reflects the authoritative registration state.
- Dedicated maintenance page.

## CI history cleanup

Earlier red runs on PR #75 were deliberate TDD checkpoints plus two real follow-up contract failures. The real failures were corrected before this checkpoint:

1. The Phase 9C database hardening contract required an explicit revoke on the replaced `private.handle_new_user()` function.
2. The new bounded-reason migration test was too literal and rejected the stronger `char_length(trim(reason))` constraint.

Intermediate fixes used `[skip ci]` to avoid a new full run for each small correction. This commit intentionally starts one consolidated backend validation run.

## Production state

No Phase 10C migration has been applied to the production ScopeForge Supabase project yet. No production platform owner has been seeded yet. Production mutation remains gated on reviewed SQL, clean tests/typecheck/build, Security Advisor review, and exact-head release validation.

## Next implementation

1. Resolve any failures from this consolidated backend checkpoint.
2. Add `/admin` overview, users, user detail, workspaces, audit, and settings pages.
3. Add the server-confirmed admin entry point from the normal workspace UI.
4. Run responsive/browser verification and full preflight.
5. Apply the reviewed forward migration and seed the intended production owner through trusted server/database access without committing PII.
6. Verify owner and non-admin boundaries, run Security Advisor, complete exact-head CI/preview review, then merge only when safe.
