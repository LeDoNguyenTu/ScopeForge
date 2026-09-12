# Phase 10C Platform Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task.

**Goal:** Build a secure platform-level admin console for ScopeForge with user/site statistics, user administration, workspace/security visibility, site controls, and auditable privileged actions.

**Architecture:** Introduce a platform-admin database boundary completely separate from workspace roles. All admin reads and writes flow through server-only code backed by the existing Supabase secret client and Auth Admin API. Add a dedicated `/admin` shell and keep destructive operations narrowly guarded.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase Auth Admin API, PostgreSQL/RLS, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-phase-10c-platform-admin-console-design.md`

## Global constraints

- Start from `afc99eb92da6b4cb84bc994f2fb66a983a941626` on `feat/phase-10c-platform-admin-console`.
- Never infer platform administration from workspace role.
- Never expose Supabase secret/service-role credentials to browser code.
- Platform tables have RLS and no browser grants.
- Use only forward migrations.
- Normal user suspension is preferred over deletion.
- Self-suspend/self-delete and routine actions against platform admins are blocked.
- Shared workspaces block hard deletion.
- Existing V5 UI, CSP, auth, RLS, worker and scanner boundaries remain non-regression requirements.

---

### Task 1: Platform admin schema and authorization

**Files:**
- Create: `supabase/migrations/20260910020000_phase_10c_platform_admin.sql`
- Modify: `lib/database.types.ts`
- Create: `lib/platform-admin/types.ts`
- Create: `lib/platform-admin/authorization.ts`
- Test: `tests/platform-admin/migration.test.ts`
- Test: `tests/platform-admin/authorization.test.ts`

**Produces:** `platform_admins`, `platform_admin_audit_events`, `platform_settings`, `requirePlatformAdmin()`.

- [ ] Write migration/authorization tests first and verify RED.
- [ ] Implement tables, RLS/no-browser-grant boundary, singleton settings row, and server-only authorization.
- [ ] Verify targeted tests and typecheck GREEN.
- [ ] Commit `[skip ci]`.

### Task 2: Platform statistics and user read model

**Files:**
- Create: `lib/platform-admin/users.ts`
- Create: `lib/platform-admin/stats.ts`
- Test: `tests/platform-admin/users.test.ts`
- Test: `tests/platform-admin/stats.test.ts`

**Produces:** paginated normalized user list/detail and aggregate platform metrics.

- [ ] Write failing tests for pagination, bounded search, auth user normalization and statistics.
- [ ] Implement using server-only `auth.admin.listUsers()` plus aggregate queries over public product tables.
- [ ] Verify targeted tests/typecheck.
- [ ] Commit `[skip ci]`.

### Task 3: Guarded user administration

**Files:**
- Create: `lib/platform-admin/user-actions.ts`
- Create: `app/admin/users/actions.ts`
- Test: `tests/platform-admin/user-actions.test.ts`

**Produces:** suspend, restore and guarded hard delete actions.

- [ ] Write failing tests for self protection, platform-admin target protection, shared-workspace refusal, confirmation mismatch, audit metadata bounds and provider error sanitization.
- [ ] Implement suspend using Auth Admin `updateUserById` and a long finite ban duration.
- [ ] Implement restore using the SDK-supported zero/none ban mechanism verified against the installed client behavior.
- [ ] Implement guarded delete only after personal workspace cleanup and exact fresh-email confirmation.
- [ ] Verify tests/typecheck.
- [ ] Commit `[skip ci]`.

### Task 4: Registration and maintenance controls

**Files:**
- Extend migration with forward replacement of `private.handle_new_user()` registration gate, or create a second forward migration if Task 1 migration is already deployed.
- Create: `lib/platform-settings/server.ts`
- Create: `app/admin/settings/actions.ts`
- Modify: `app/auth/sign-up/page.tsx`
- Add application maintenance guard at the narrowest server boundary that does not break auth/admin/worker endpoints.
- Create: `app/maintenance/page.tsx`
- Test: `tests/platform-admin/settings.test.ts`
- Test: `tests/platform-admin/maintenance.test.ts`

- [ ] Write failing registration/maintenance tests.
- [ ] Implement authoritative database signup guard and server-rendered maintenance behavior.
- [ ] Ensure internal worker routes and `/admin` remain reachable.
- [ ] Verify tests/build.
- [ ] Commit `[skip ci]`.

### Task 5: Admin UI

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/admin.css`
- Create: `app/admin/page.tsx`
- Create: `app/admin/users/page.tsx`
- Create: `app/admin/users/[userId]/page.tsx`
- Create: `app/admin/workspaces/page.tsx`
- Create: `app/admin/audit/page.tsx`
- Create: `app/admin/settings/page.tsx`
- Create focused client components only for destructive confirmation/forms as needed.
- Test: `tests/platform-admin/ui.test.tsx`

- [ ] Write failing authorization/render tests.
- [ ] Implement dedicated admin shell and pages.
- [ ] Add server-confirmed admin entry link to the normal dashboard without leaking it to non-admins.
- [ ] Verify responsive UI, typecheck and build.
- [ ] Commit `[skip ci]`.

### Task 6: Production bootstrap, security review and release

**Files:**
- Create: `docs/development/PHASE_10C_WORKING_STATE.md`
- Create: `docs/development/PHASE_10C_RELEASE_STATE.md` after evidence exists
- Update: `CURRENT_STATE.md`, `NEXT_STEPS.md`, `SESSION_HANDOFF.md`, `UNFINISHED_WORK.md`, `docs/PHASES.md`, `docs/ARCHITECTURE.md` as truth changes.

- [ ] Run full preflight: audit, tests, typecheck, CLI build/version, scanner benchmarks, production build.
- [ ] Apply the reviewed forward migration to ScopeForge Supabase.
- [ ] Seed the intended production owner through a one-time trusted insert without committing PII.
- [ ] Verify owner/non-admin access boundaries.
- [ ] Run Supabase Security Advisor and inspect grants/policies.
- [ ] Open PR and require exact-head CI/Preview/browser gates.
- [ ] Perform full diff/security review.
- [ ] Merge with expected head SHA only when green.
- [ ] Verify post-merge production deployment, CSP, auth and runtime logs.
- [ ] Reconcile documentation with any Phase 10A changes that merged first.
