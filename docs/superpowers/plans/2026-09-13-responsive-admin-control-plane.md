# Responsive Admin Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild ScopeForge admin and GitHub operational surfaces into a coherent desktop/mobile control-plane UI with no normal mobile horizontal overflow while preserving all authorization, routing and backend behavior.

**Architecture:** Keep existing server pages and data loaders authoritative. Introduce a focused client-side admin navigation component only where pathname-aware active state is needed, retain server-side authorization in `app/admin/layout.tsx`, and implement dual desktop-table/mobile-card compositions for dense records. Use existing CSS architecture and brand tokens; add no runtime dependency.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, CSS, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-13-responsive-admin-control-plane-design.md`

## Global Constraints

- Preserve existing platform-admin authorization and server-side `requirePlatformAdmin()` boundary.
- Preserve GitHub connection/import server actions and runtime capability gates.
- No Supabase schema changes.
- No Phase 10A2/10A3 runtime behavior changes.
- No new runtime dependency.
- Phone acceptance at approximately 390 px and 430 px with no ordinary document-level horizontal overflow.
- Keep Forge Aperture graphite/teal/cyan/orange visual identity.
- Keep destructive actions server-authorized and visually isolated.
- Document the latest branch/head, verification and resume point before leaving the task.

---

### Task 1: Responsive admin navigation shell

**Files:**
- Create: `components/platform-admin/AdminNavigation.tsx`
- Modify: `app/admin/layout.tsx`
- Modify: `app/admin/admin.css`
- Create: `tests/platform-admin/responsive-shell.test.ts`

**Interfaces:**
- `AdminNavigation({ email, role }: { email: string; role: "owner" | "admin" })`
- Server `AdminLayout` continues calling `requirePlatformAdmin()` and passes only safe identity strings to the navigation component.

- [ ] Write a failing structure test asserting the admin layout delegates navigation to `AdminNavigation`, the mobile navigation class exists, and CSS no longer defines the five-item `min-width: 110px` horizontal strip.
- [ ] Run the focused test in CI and confirm red state before implementation.
- [ ] Implement `AdminNavigation` using `usePathname()` for active state, Forge Aperture wordmark, desktop rail links, compact identity/back-to-workspace area, and mobile primary navigation.
- [ ] Update `app/admin/layout.tsx` without changing authorization/error behavior.
- [ ] Refactor shell CSS for desktop rail plus compact mobile header/navigation. Remove the legacy mobile five-column horizontal-strip rule.
- [ ] Run focused tests and typecheck.
- [ ] Commit `feat: rebuild responsive admin navigation`.

### Task 2: Shared admin responsive primitives and overview

**Files:**
- Modify: `app/admin/admin.css`
- Modify: `app/admin/page.tsx`
- Create: `components/platform-admin/AdminPageHeader.tsx`
- Create: `components/platform-admin/AdminMetricCard.tsx`
- Create: `tests/platform-admin/overview-ui.test.ts`

**Interfaces:**
- `AdminPageHeader({ eyebrow, title, description, actions? })`
- `AdminMetricCard({ label, value, hint, icon })`

- [ ] Write failing tests pinning reusable page-header/metric usage and the overview metric/status composition.
- [ ] Confirm tests fail before implementation.
- [ ] Extract page-header and metric-card primitives with no data-loading behavior.
- [ ] Recompose Overview with clearer control-plane hierarchy, responsive metric grid, site-control status and administrative-boundary panels.
- [ ] Add CSS for shared operational page header, metrics, panels, badges, action groups, empty states and responsive pagination.
- [ ] Run focused tests and typecheck.
- [ ] Commit `feat: refine admin overview hierarchy`.

### Task 3: Users, Workspaces and Audit dual desktop/mobile records

**Files:**
- Modify: `app/admin/users/page.tsx`
- Modify: `app/admin/workspaces/page.tsx`
- Modify: `app/admin/audit/page.tsx`
- Modify: `app/admin/admin.css`
- Create: `tests/platform-admin/responsive-records.test.ts`

**Interfaces:**
- Existing data loaders and pagination helpers remain unchanged.
- Each page renders `.adminDesktopTable` and `.adminMobileCards` from the same server result.

- [ ] Write failing tests requiring mobile-card markup on all three pages and requiring CSS to hide tables on phone widths while hiding mobile cards on desktop.
- [ ] Confirm red state.
- [ ] Add semantic mobile user cards: identity, status, platform role, workspace count, created and last sign-in, plus detail link.
- [ ] Add semantic mobile workspace cards: workspace identity, creator, members/assets/scans/findings/recent activity.
- [ ] Add semantic mobile audit cards: time, action, actor, targets, reason and bounded metadata.
- [ ] Keep desktop tables for dense scanning and preserve existing query/pagination behavior.
- [ ] Ensure long IDs/emails/repository-like strings wrap safely.
- [ ] Run focused tests and typecheck.
- [ ] Commit `feat: add mobile admin record views`.

### Task 4: Settings and detail-page responsive cleanup

**Files:**
- Modify: `app/admin/settings/page.tsx`
- Modify: `components/platform-admin/PlatformSettingsForm.tsx`
- Modify: `app/admin/users/[userId]/page.tsx`
- Modify: `app/admin/admin.css`
- Create: `tests/platform-admin/settings-detail-ui.test.ts`

**Interfaces:**
- Existing settings/user server actions and authorization remain unchanged.

- [ ] Write failing tests for grouped settings presentation, danger/control separation, and responsive user-detail composition.
- [ ] Confirm red state.
- [ ] Group platform availability and provider-owned controls into clear operational sections.
- [ ] Improve responsive form/action layout without changing mutation payloads or validation.
- [ ] Reflow user detail definition lists/actions for mobile and isolate destructive actions visually.
- [ ] Run focused tests and typecheck.
- [ ] Commit `feat: refine admin settings and details`.

### Task 5: First-class responsive GitHub connected-project UI

**Files:**
- Modify: `app/dashboard/integrations/github/page.tsx`
- Modify: `components/integrations/GitHubRepositoryPicker.tsx`
- Modify: `app/ui-refinement.css`
- Create: `tests/github-app/responsive-ui.test.tsx`

**Interfaces:**
- `GitHubRepositoryPicker` keeps the same `repositories`, `page`, `hasNextPage` props.
- `linkGitHubRepository(formData)` and callback/connect routes are unchanged.

- [ ] Write failing tests requiring dedicated GitHub integration classes, responsive repository-card structure and unchanged import action call.
- [ ] Confirm red state.
- [ ] Recompose connected/disconnected/error states with a dedicated operational header and connection-status surface.
- [ ] Replace generic `assetRow` repository presentation with `githubRepositoryList/githubRepositoryCard` markup.
- [ ] Keep branch/privacy metadata grouped and put import action in a non-competing action region that becomes full-width on phones.
- [ ] Add responsive CSS with safe wrapping and no row-level horizontal collisions.
- [ ] Run GitHub-app tests and typecheck.
- [ ] Commit `feat: rebuild responsive GitHub repository picker`.

### Task 6: Full verification, visual acceptance, documentation and PR

**Files:**
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify when useful: `docs/development/SESSION_HANDOFF.md`

- [ ] Run full `npm test` in CI and require zero failures.
- [ ] Run `npm run typecheck` and production `npm run build` through the existing validation workflow/deployment checks.
- [ ] Inspect Vercel preview at desktop and phone widths for Admin Overview, Users, Workspaces, Audit, Settings and GitHub integration. Any horizontal overflow, overlap or clipped primary action is a blocker.
- [ ] Verify backend behavior was not changed by reviewing the branch diff for authorization, server-action and runtime-gate files.
- [ ] Update resume docs with branch, exact verified head, completed tasks, verification evidence and the explicit post-UI Phase 10A queue.
- [ ] Open a draft PR, review changed files and CI evidence, then mark ready/merge only after visual acceptance.
- [ ] After merge, immediately resume issue #79 negative/security evidence, then Phase 10A2 PR #76 release sequence, then Phase 10A3 PR #77.

## Self-review

- Spec coverage: navigation, admin overview, users/workspaces/audit, settings/details, GitHub integration, responsive/accessibility requirements, visual acceptance and resume documentation all map to explicit tasks.
- Placeholder scan: no deferred implementation placeholders are present.
- Type/interface consistency: new component props are defined in the task that creates them; later tasks do not rely on undeclared APIs.
- Scope isolation: no Phase 10A2/10A3 backend behavior or schema work is included.
