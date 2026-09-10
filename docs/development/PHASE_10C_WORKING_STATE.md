# Phase 10C Platform Admin Console Working State

Date: 2026-09-10
Branch: `feat/phase-10c-platform-admin-console`
PR: #75
Status: implementation complete enough for exact-head validation, production database unchanged

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
- `/admin` overview, users, user detail, workspaces, audit, and settings surfaces.
- Server-confirmed admin entry point from the normal workspace UI.
- Maintenance-mode routing for the public landing page and authenticated tenant dashboard while keeping admin, auth, maintenance, and API surfaces reachable.
- Registration page reflects the authoritative registration state.
- Dedicated maintenance page.
- Secretless public availability reader used by landing, sign-up, and maintenance routes.
- Narrow browser read access limited to `id`, registration state, maintenance state/message, and the update timestamp, protected by a dedicated SELECT policy.
- Exact built-in CI Supabase placeholder compatibility without a generic production fail-open.

## CI history cleanup

Earlier red runs on PR #75 were deliberate TDD checkpoints plus real follow-up contract failures. Intermediate implementation commits use `[skip ci]` so every small TDD transition does not produce a full CI run.

Candidate `8590e8a5a8af0b72bfed68e812c53cb9c8437413` passed 1,611 tests, typecheck, CLI build, scanner benchmark, benchmark matrix, and the Next.js production build. Its CSP browser readiness gate then exposed a second environment-only issue: CI deliberately supplies `https://example.supabase.co` and `sb_publishable_example`, so the public availability reader correctly could not reach a real platform settings row. The reader now recognizes only that exact built-in fixture pair when using its normal non-injected fetch path and returns normal-open defaults. Arbitrary provider failures and real project configurations continue to fail closed.

This commit intentionally starts the next exact-head validation run.

## Production state

No Phase 10C migration has been applied to the production ScopeForge Supabase project yet. No production platform owner has been seeded yet. Production mutation remains gated on clean exact-head CI/browser validation, reviewed SQL, Security Advisor review, and a final security review.

## Remaining release gates

1. Exact-head unit, type, build, benchmark, CSP browser, and production diagnostic validation.
2. Review the complete PR diff for privilege, deletion, and maintenance regressions.
3. Apply the reviewed forward migration to the ScopeForge production Supabase project.
4. Seed the intended initial platform owner through trusted database access without committing account identifiers.
5. Verify owner and non-admin authorization boundaries, registration control, maintenance behavior, and audit writes.
6. Run database security advisors and reconcile findings.
7. Merge only when the exact release head is clean and the production checks are safe.
