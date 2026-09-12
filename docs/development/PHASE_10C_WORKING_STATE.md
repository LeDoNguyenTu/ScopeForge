# Phase 10C Platform Admin Console Working State

Date: 2026-09-10
Branch: `feat/phase-10c-platform-admin-console`
PR: #75
Status: production database migrated and owner bootstrapped; final exact-head code validation pending

## Completed in branch

- Dedicated platform administration boundary separate from workspace roles.
- `platform_admins`, `platform_admin_audit_events`, and singleton `platform_settings` forward migrations.
- RLS enabled on platform tables with no browser mutation authority.
- Explicit deny-all browser policies on locked admin identity/audit tables as defense in depth.
- Last-platform-owner database guard.
- Authoritative registration gate in `private.handle_new_user()` with explicit function execution revocation.
- Server-side platform admin authorization using the trusted Supabase client.
- Bounded platform user listing/search/detail normalization.
- Platform user workspace membership read model.
- Aggregate platform user/workspace/asset/scan/finding statistics.
- Guarded suspend and restore through Supabase Auth Admin APIs.
- Guarded hard deletion with exact fresh email confirmation, self/admin protection, exclusive-workspace-membership verification, and personal-workspace cleanup ordering.
- Platform mutation audit events with bounded reason and metadata fields.
- Suspend, restore, hard-delete, and platform-settings mutations record intent before the provider/data mutation and completion afterward where possible.
- Platform settings service for registration and maintenance state.
- `/admin` overview, users, user detail, workspaces, audit, and settings surfaces.
- Server-confirmed admin entry point from the normal workspace UI.
- Maintenance-mode routing for the public landing page and authenticated tenant dashboard while keeping admin, auth, maintenance, and API surfaces reachable.
- Registration page reflects the authoritative registration state.
- Dedicated maintenance page.
- Secretless public availability reader used by landing, sign-up, and maintenance routes.
- Narrow browser read access limited to `id`, registration state, maintenance state/message, and the update timestamp, protected by a dedicated SELECT policy.
- Exact built-in CI Supabase placeholder compatibility, additionally gated by `CI=true`, without a generic production fail-open.

## CI history cleanup

Earlier red runs on PR #75 were deliberate TDD checkpoints plus resolved follow-up contract failures. Intermediate implementation commits use `[skip ci]` so every small TDD transition does not produce a full CI run.

Release candidate `b4a8fbc8985c27d04ad32a2feaa983d2b8ec7f98` passed the complete pipeline: unit tests, typecheck, CLI build/version, scanner benchmark, benchmark matrix, Next.js production build, CSP browser smoke, production V5/Turnstile diagnostic, and screenshot upload.

After that green candidate, production rollout review added only migration-history alignment and explicit deny-policy defense in depth. The repository migration filenames now exactly match the versions recorded by the Supabase management API so future migration pushes cannot replay the Phase 10C table creation.

## Production database evidence

Confirmed production project: ScopeForge (`tdgpibrepzcvdivztkta`), not the Job Command Center project.

Applied production migrations:

- `20260910153743_phase_10c_platform_admin`
- `20260910154017_phase_10c_explicit_browser_deny_policies`

The intended real ScopeForge account was unambiguous from production Auth/profile data and was bootstrapped as the single platform owner. The portfolio demo account has no platform-admin row. No production user identifier or email is committed to repository source.

Verified after bootstrap:

- exactly one platform-admin row exists
- exactly one platform owner exists
- demo account platform-admin count is zero
- registration remains enabled
- maintenance mode remains disabled
- `anon` and `authenticated` cannot read `platform_admins`
- `anon` may read the narrow registration availability field
- `anon` cannot read `platform_settings.updated_by`
- `anon` and `authenticated` cannot execute `private.handle_new_user()` directly
- public availability SELECT policy exists
- a safe last-owner deletion probe was blocked and the owner row remained intact
- post-migration Security Advisor reports no Phase 10C RLS/table findings

The only remaining Supabase Security Advisor warning is the pre-existing project-level Auth warning that leaked-password protection is disabled. The current connector can verify but does not expose that Auth-setting mutation.

## Migration history invariant

The pre-deployment filename `20260910020000_phase_10c_platform_admin.sql` was never a production migration version and has been removed from the branch. Repository source now uses the two exact production versions above. Deployed migration contents remain immutable.

## Remaining release gates

1. Confirm the current exact branch head passes unit, type, build, benchmark, CSP browser, and production diagnostic validation after migration-history alignment.
2. Merge PR #75 only when that exact head is green.
3. Verify the merged production deployment serves the admin surface and existing public/dashboard presentation without runtime regressions.
4. Keep leaked-password protection as an explicit external provider follow-up until a supported management surface is available.
