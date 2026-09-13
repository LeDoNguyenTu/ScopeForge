# Responsive Admin Control Plane Design

Date: 2026-09-13
Status: Approved
Branch: `feat/admin-ui-responsive-control-plane`

## Objective

Refactor ScopeForge's platform-admin and newer operational screens into one coherent responsive system. Preserve the existing ScopeForge Forge Aperture visual identity and all authorization/routing/server-action semantics, while making the admin experience acceptable on mobile and more efficient on desktop.

The redesign follows a hybrid direction:

- the admin overview may retain a richer, more cinematic ScopeForge control-plane presentation;
- operational pages such as Users, Workspaces, Audit, Settings and GitHub integration use denser Vercel/Supabase-style information layouts;
- mobile is a purpose-built composition, not a compressed desktop view.

## Existing problems

The current admin area is visually and structurally separate from the main authenticated workspace. Its mobile breakpoint collapses the left sidebar into a horizontal navigation row while each nav item retains a large minimum width, and data tables retain desktop-oriented minimum widths. This creates horizontal scrolling, poor hierarchy and controls that compete for space.

Newer feature surfaces have accumulated additional one-off layouts. The GitHub repository picker currently reuses the generic asset-row structure, placing repository identity, branch metadata, visibility and import actions on one horizontal row. That is acceptable only at wider widths and degrades badly on phones.

## Design principles

1. Keep the Forge Aperture brand, graphite base, forged teal/cyan accents and restrained orange risk/emphasis accent.
2. Preserve authorization, routing, GitHub connection semantics, server actions and backend data contracts.
3. Use separate desktop/tablet and mobile compositions where the information hierarchy differs.
4. No ordinary admin or GitHub workflow may require document-level horizontal scrolling.
5. Primary actions must remain reachable and legible on phones.
6. Long identifiers, repository names, branches and email addresses must wrap or truncate safely without moving controls outside their containers.
7. Future operational features should compose shared responsive primitives rather than add another bespoke layout system.
8. No new runtime dependency is required for this redesign.

## Navigation architecture

### Desktop and tablet

Use a compact left control-plane rail for platform-admin routes. The rail contains:

- ScopeForge Forge Aperture branding;
- Overview;
- Users;
- Workspaces;
- Audit;
- Settings;
- current platform-admin identity and role;
- a clear return-to-workspace action.

The main content area remains wide enough for operational data but uses consistent max-width, gutters, vertical rhythm and page headers.

### Mobile

Do not render the desktop rail as a horizontally scrolling five-item strip.

Use:

- a compact ScopeForge admin header;
- contextual page title and actions beneath the header;
- a fixed or sticky mobile navigation treatment for the primary admin sections, optimized for thumb reach;
- identity and return-to-workspace actions in a compact secondary/account area rather than permanently consuming vertical space.

The main content uses one-column cards and stacked controls. Normal use must not create horizontal page overflow.

## Screen hierarchy

### Admin Overview

The overview is the richest admin screen. It should communicate control-plane state quickly:

- platform health/status summary;
- users, workspaces, assets, scans, findings and critical-risk metrics;
- registration and maintenance state;
- recent operational/audit activity where already available;
- clear shortcuts to high-value administrative screens.

It may use larger metric surfaces and richer visual hierarchy than the rest of admin, but must remain restrained compared with the WebGL workspace dashboard.

### Users and Workspaces

Desktop uses dense operational data views with filters/search and clear row actions.

Mobile transforms each row into a vertical card rather than forcing the desktop table into a narrow viewport. A mobile card surfaces:

- primary identity first;
- status/role badges second;
- supporting counts/metadata beneath;
- actions last, with destructive actions visually separated.

### Audit

Desktop remains table-oriented because scanability matters. Mobile becomes stacked audit event cards with timestamp, actor, action, target and outcome grouped consistently.

### Settings

Settings are grouped into clear sections instead of presenting a visually flat long form. Dangerous platform controls are isolated into a separate danger/confirmation section. Existing server-side behavior remains unchanged.

### GitHub integration

Treat connected projects as a first-class operational screen rather than a generic panel appended to the asset layout.

The screen hierarchy is:

1. connection/account state and installation health;
2. repository search/filter controls where available;
3. responsive repository list;
4. pagination/status feedback.

Desktop may present repositories as a compact list. Mobile renders repository cards containing:

- owner/repository name;
- default branch;
- public/private visibility;
- import/connection state;
- primary import/open action on its own row, full-width when necessary.

No repository action should compete horizontally with a long repository name.

### Project/asset detail additions

New repository/runtime information should use dedicated detail sections/cards instead of continuously extending legacy asset rows. Existing asset behavior remains intact.

## Shared UI primitives

Create or formalize reusable primitives for newer operational work:

- `AdminShell` / admin navigation composition;
- `OperationalPageHeader`;
- metric/stat cards;
- `StatusBadge`;
- responsive data view that supports desktop table and mobile card composition;
- `FilterBar`;
- `ActionBar`;
- `OperationalEmptyState`;
- responsive pagination;
- mobile detail rows / definition lists.

Do not create abstraction solely for abstraction's sake. A primitive is justified when at least two current operational surfaces benefit from the same behavior or visual contract.

## Interaction states

Every affected screen must explicitly support:

- loading/pending state for client mutations;
- success confirmation where the current flow returns it;
- safe empty state;
- recoverable error state;
- disabled action state;
- keyboard focus-visible state;
- destructive-action confirmation where already required or where an existing destructive action currently lacks clear visual separation.

No backend mutation semantics change as part of this UI project.

## Responsive requirements

Acceptance widths include at minimum:

- approximately 390 px phone;
- approximately 430 px phone;
- tablet around 768-1024 px;
- desktop at 1280 px and above.

At phone widths:

- no document-level horizontal overflow in normal admin/GitHub flows;
- no overlapping controls or labels;
- no navigation item may rely on a 110 px minimum width horizontal strip;
- desktop admin tables must not remain the sole representation of records;
- primary actions should become full-width when that improves clarity/touchability;
- minimum touch targets should remain practical for mobile interaction;
- typography must be readable without browser zoom.

## Accessibility

Preserve existing semantic navigation and landmark structure. Ensure:

- skip links remain available;
- navigation has an accessible label;
- active navigation state is programmatically exposed;
- focus-visible treatment is retained or improved;
- icon-only actions have accessible names;
- mobile cards retain the same actionable information exposed on desktop;
- color is not the only status signal.

## Testing and visual acceptance

Add focused component/structure tests that pin the responsive architecture and prevent regression to the current broken patterns. Tests should verify the expected shell/navigation classes or component composition, mobile record/card rendering where applicable, and critical route behavior remains unchanged.

Run the repository's existing typecheck/test/build gates after implementation.

Visual acceptance must inspect representative pages at desktop and phone widths, including:

- Admin Overview;
- Users;
- Workspaces;
- Audit;
- Settings;
- GitHub integration connected state;
- repository picker/import state;
- at least one representative newer asset/project detail page if modified.

Release blockers:

- any ordinary admin page horizontally scrolls at 390 px because of layout width;
- text/control overlap;
- clipped primary actions;
- unreadably small mobile text;
- GitHub repository identity/action collisions;
- admin navigation requiring the current five large horizontally scrolling buttons;
- authorization/routing regression.

## Release isolation

Implement this redesign on `feat/admin-ui-responsive-control-plane`, based on current `main`.

Do not mix Phase 10A2 private-repository acquisition behavior or Phase 10A3 webhook behavior into this UI branch. The UI branch may style already-released Phase 10A1 GitHub connected-project surfaces, but backend release gates and runtime capability flags remain unchanged.

After the UI PR is verified and merged, reconcile still-open Phase 10A branches with the new main only as required.

## Resume documentation

Maintain a resume point while implementing. At minimum update `docs/development/CURRENT_STATE.md` and/or the most relevant handoff document with:

- active UI branch;
- latest verified commit;
- completed UI tasks;
- verification evidence;
- remaining UI tasks;
- explicit instruction to return to the Phase 10A release queue after UI completion.

## Post-UI queue

After the UI refactor is complete and released, resume the previously approved ScopeForge sequence:

1. finish remaining negative/security evidence for GitHub provider issue #79 and close only when justified;
2. re-read the actual PR #76 head and production migration history;
3. apply only the reviewed, absent Phase 10A2 migrations to the correct ScopeForge Supabase project;
4. complete private repository worker/runtime acceptance and release PR #76;
5. reconcile PR #77 onto released Phase 10A2/main and perform fresh exact validation;
6. apply and validate Phase 10A3 operational webhook changes;
7. release PR #77 only after operational checks;
8. continue with the next documented ScopeForge tasks.

The historical Phase 6D Task 15/16 Oracle Linux acceptance is already complete and is not a pending Codex handoff.

## Non-goals

- No redesign of the public landing page.
- No replacement of the existing WebGL attack-surface dashboard concept.
- No authorization model changes.
- No Supabase schema changes solely for UI presentation.
- No GitHub App permission changes.
- No enabling of private snapshot/scan or webhook runtime flags.
- No new design dependency unless a later verified implementation need is separately approved.
