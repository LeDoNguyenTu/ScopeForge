# Phase 10C Platform Admin Console Working State

Date: 2026-09-10
Branch: `feat/phase-10c-platform-admin-console`
PR: #75
Status: final release-candidate validation, production database unchanged

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

Earlier red runs on PR #75 were deliberate TDD checkpoints plus real follow-up contract failures. Intermediate implementation commits use `[skip ci]` so every small TDD transition does not produce a full CI run.

Release candidate `fa5c9cb058c0e66b5da41f469d85d4bd9d2d3132` passed the entire pipeline: unit tests, typecheck, CLI build/version, scanner benchmark, benchmark matrix, Next.js production build, CSP browser smoke, production V5/Turnstile diagnostic, and screenshot upload.

A subsequent security review found and fixed two final integrity issues before production deployment. Hard deletion now requires every target-created workspace to have exactly one member and that member must be the target account. Zero-member, sole-other-member, and multi-member workspaces all block deletion. Administrative mutations now write an attempted-action audit event before changing Supabase Auth or platform settings so a provider failure cannot erase all evidence that the privileged action was attempted. The public CI placeholder fallback also requires `CI=true`, preventing an accidentally fixture-configured production deployment from silently failing open.

This commit intentionally starts one final exact-head validation run for the completed release candidate.

## Production state

No Phase 10C migration has been applied to the production ScopeForge Supabase project yet. No production platform owner has been seeded yet. Production mutation remains gated on clean exact-head CI/browser validation, reviewed SQL, Security Advisor review, and final security review.

## Remaining release gates

1. Confirm the current exact head passes unit, type, build, benchmark, CSP browser, and production diagnostic validation.
2. Apply the reviewed forward migration to the ScopeForge production Supabase project.
3. Seed the intended initial platform owner through trusted database access without committing account identifiers.
4. Verify owner and non-admin authorization boundaries, registration control, maintenance behavior, and audit writes.
5. Run database security advisors and reconcile findings.
6. Merge only when the exact release head and production checks are clean.
