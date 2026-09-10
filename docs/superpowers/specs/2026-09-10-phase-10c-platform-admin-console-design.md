# Phase 10C Platform Admin Console Design

Status: pre-approved by user on 2026-09-10
Baseline: `afc99eb92da6b4cb84bc994f2fb66a983a941626`

## Goal

Add a first-class platform administration surface inside ScopeForge so the site owner can inspect users and product/security activity and perform common administrative actions without opening Supabase Studio.

This is platform administration, not workspace administration. Existing workspace roles remain tenant-scoped and never grant access to `/admin`.

## Authorization model

Create `public.platform_admins` with roles `owner` and `admin`.

- Platform authorization is resolved only by trusted server code using the server-side Supabase secret client.
- The browser receives no direct table mutation authority.
- `platform_admins` has RLS enabled and no `anon` or `authenticated` table privileges.
- A user may be a workspace owner and still have zero platform privileges.
- Platform owners may administer ordinary users and later add/remove platform admins.
- Platform admins may perform routine administration but may not delete, suspend, or demote a platform owner.
- The last platform owner can never be removed.
- The currently authenticated platform administrator cannot suspend or hard-delete their own account.

The first production owner is seeded directly in production through the trusted Supabase connection after the forward migration. No real user UUID or email is committed to GitHub.

## Admin audit trail

Create `public.platform_admin_audit_events`.

Every platform mutation records:

- actor user ID
- action
- target user/workspace when relevant
- bounded reason
- bounded metadata with no tokens/secrets
- timestamp

The table has RLS enabled and no browser grants. Admin pages read it server-side.

## Site settings

Create a singleton `public.platform_settings` row with:

- `registration_enabled boolean default true`
- `maintenance_mode boolean default false`
- `maintenance_message text`
- timestamps and updater identity

No browser grants.

Registration disabling must be authoritative even when a client calls Supabase Auth directly. A forward migration updates the existing `private.handle_new_user()` trigger function so that, when registration is disabled, it rejects creation before profile/workspace onboarding. Existing users are unaffected.

Maintenance mode is enforced by server-side application routing/page guards. Platform administrators can still access `/admin`; authentication and a minimal maintenance page remain reachable. Maintenance mode does not alter worker or scanner authorization.

## Admin overview

`/admin` shows server-computed metrics:

- total Auth users
- users created in the last 24 hours and 7 days
- users who signed in in the last 24 hours and 7 days
- total workspaces
- total registered assets
- total scan jobs with queued/running/succeeded/failed breakdown
- total open security findings with severity breakdown
- repository snapshots
- worker node/task health where available
- current platform settings

Auth user information is retrieved only through the Supabase server-side Auth Admin API. Supabase secret credentials never reach the browser.

## User administration

`/admin/users` provides paginated search/listing with:

- email
- display name
- created time
- last sign-in time
- confirmation state
- ban state
- workspace count
- platform-admin status

`/admin/users/[userId]` shows safe account and workspace/activity details.

Supported mutations:

### Suspend user

Use Supabase `auth.admin.updateUserById()` with a long finite `ban_duration` supported by Supabase. Suspending a user blocks future authentication but the UI must state that an already-issued access token can remain valid until JWT expiry.

### Restore user

Clear the Auth ban using the supported Supabase Auth Admin mechanism verified by tests/current SDK behavior. Do not use direct writes to Supabase-managed Auth tables.

### Hard-delete user and personal data

This is deliberately guarded:

- cannot target current admin
- cannot target any platform owner/admin in v1
- requires exact email confirmation and a reason
- inspect all workspaces created by target
- if any target-created workspace has another member, refuse with `USER_OWNS_SHARED_WORKSPACE`
- for private/personal workspaces only, delete those workspaces through trusted server data access so tenant data cascades through existing foreign keys
- call Supabase Auth Admin `deleteUser()` only after workspace ownership blockers are removed
- record audit evidence before/after as safely possible

No arbitrary SQL or arbitrary service-role action is exposed to the UI.

## Workspace and security activity administration

`/admin/workspaces` lets the platform administrator search workspaces and inspect:

- owner/creator
- members
- assets
- scan counts/status
- open findings/severity
- recent activity

V1 is primarily observational. Workspace deletion is not exposed as a one-click general action because it is destructive and not required to replace routine Supabase usage.

## Site controls

`/admin/settings` includes:

- Open/close new account registration
- Enable/disable maintenance mode
- Edit a bounded maintenance message

Changes require an explicit reason and write an admin audit event.

External provider controls such as Vercel environment variables, Cloudflare WAF/Turnstile configuration, and Supabase project-level leaked-password protection remain external provider state unless a supported management API is intentionally integrated. The admin console reports their known/unknown status but must not pretend to control them.

## UI

Use a dedicated admin shell, visually consistent with ScopeForge but clearly differentiated from a tenant workspace.

Navigation:

- Overview
- Users
- Workspaces
- Audit
- Settings
- Back to workspace

The admin entry appears only when server-rendered authorization confirms a platform administrator. Direct navigation by a normal authenticated user returns a not-found/forbidden boundary without leaking platform data.

## Security requirements

- No workspace role implies platform access.
- Never authorize from `user_metadata`.
- Never expose `SUPABASE_SECRET_KEY` or service-role client to browser code.
- No browser direct writes to platform admin/settings/audit tables.
- All actions re-check current user server-side.
- User IDs are validated as UUIDs.
- All free-text reasons/messages are bounded.
- Email confirmation for hard deletion must match the fresh Auth Admin user record server-side.
- Admin action errors are bounded and do not return provider bodies.
- Self-suspend/self-delete are blocked.
- Platform-admin targets are protected from routine user actions.
- Last-owner protection is enforced in server logic and database constraints/guards where practical.
- Admin routes are dynamic and never cached across users.
- Existing CSP, RLS, RPC, worker, and scanner boundaries remain unchanged.

## Current Supabase compatibility

Current Supabase documentation confirms `auth.admin.listUsers()`, `auth.admin.getUserById()`, `auth.admin.updateUserById()` including `ban_duration`, and `auth.admin.deleteUser()` are trusted-server operations. The project already has a server-only secret Supabase client.

The 2026 Supabase changelog also notes that public-schema Data API auto-exposure behavior is changing. This design explicitly uses no browser grants for platform administration tables, so it does not depend on automatic exposure.

## Tests

TDD coverage must include:

- workspace owners denied platform access
- platform owner/admin authorization
- no direct authenticated grants on admin tables
- self-action protection
- platform-admin target protection
- last-owner protection
- user list pagination/search normalization
- stats aggregation
- suspend/restore provider call behavior with bounded errors
- hard-delete shared-workspace refusal
- hard-delete confirmation mismatch refusal
- personal-workspace cleanup ordering before Auth deletion
- registration trigger blocks new users when setting disabled
- registration trigger allows users when enabled
- maintenance guard allows admin/auth routes and blocks ordinary application routes when enabled
- no secret/service-role value reaches client components
- audit events contain no credentials/tokens
- existing auth/CSP/browser gates remain green

## Operational bootstrap

After the migration is reviewed and applied, query production Auth users through the trusted connection and seed the intended site owner into `platform_admins` using a one-time privileged insert. Do not put production user identifiers in migration source.

Verify:

1. exactly the intended owner row exists
2. normal test/demo user has no platform-admin row
3. owner can load `/admin`
4. demo user cannot load `/admin`
5. Security Advisor shows no new findings

## Release boundary

Phase 10C ships independently from Phase 10A GitHub-connected projects. Each has its own branch, PR, migration, tests, preview, review, and merge evidence. If both modify shared documentation, rebase the later branch onto current `main` before release and reconcile docs rather than overwriting newer state.
