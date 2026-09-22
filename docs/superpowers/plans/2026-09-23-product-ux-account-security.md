# Product UX and Account Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a coherent, responsive ScopeForge UI, correct stale interaction state, add transient notifications, and provide secure password recovery, TOTP MFA, and passkey account controls.

**Architecture:** Build a small shared feedback and form foundation, migrate mutation surfaces to authoritative state plus toasts, then add Supabase-native account security routes and guards. Finish with a route/role/viewport acceptance matrix and exact-candidate release evidence.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase Auth/Postgres, Vitest, Testing Library, Chrome browser verification, GitNexus.

**Spec:** `docs/superpowers/specs/2026-09-23-product-ux-account-security-design.md`

## Global Constraints

- Node.js must remain `>=24 <25`.
- The production Supabase project is exactly `tdgpibrepzcvdivztkta`.
- Email OTP is AAL1 recovery/passwordless authentication and must not be labeled AAL2.
- Password plus verified TOTP is the supported second-factor AAL2 flow.
- Passkeys are preferred passwordless authentication and remain capability-checked while the Supabase API is experimental.
- Authorization, RLS, CSP, target verification, containment, worker boundaries, and request/runtime budgets must remain unchanged.
- No existing Phase 11 canary may be rerun or rewritten.
- All source changes use failing tests first; exact-head CI is required before merge.
- Refresh GitNexus after the final code change and include its tracked output in the commit.

## Review Focus

- A refreshed collaborator prop must replace a stale locally selected role without reverting an in-flight submission.
- Toast timers must stop during hover/focus and must not update state after provider unmount.
- Recovery requests must return non-enumerating copy for known and unknown addresses.
- An enrolled TOTP user at AAL1 must never reach a privileged owner/admin surface before successful verification.
- Unsupported or provider-disabled passkeys must fall back cleanly without blocking password/TOTP sign-in.

---

### Task 1: Establish the clean baseline and impact map

**Files:**
- Inspect: `package.json`
- Inspect: `vitest.config.ts`
- Inspect: `.gitnexus/`

**Interfaces:**
- Consumes: live `origin/main` and the approved design spec.
- Produces: recorded baseline results and upstream impact reports for every edited symbol.

- [ ] **Step 1: Verify identity and repository state**

Run `git remote -v`, `git rev-parse HEAD`, `gh repo view`, `gh pr list --state open`, and `git worktree list` from the isolated worktree. Expected: repository `LeDoNguyenTu/ScopeForge`, head `47eb24aa1c2462ad71ae0aa99613f9b55ac51af2` or a verified later `origin/main`, and no collision with dirty user worktrees.

- [ ] **Step 2: Record the existing suite baseline**

Run `npm test`. Expected baseline on this Windows host: 2281 passing, 26 skipped, and three timing-related failures in the two heavy-fixture benchmarks plus ground-truth integrity. Re-run those three tests serially before classifying them as product failures.

- [ ] **Step 3: Run GitNexus impact analysis**

Run upstream impact for `RootLayout`, `CollaboratorControls`, `manageCollaborator`, `FindingLifecycleControls`, `createClient`, `updateSession`, `AppShell`, and `ImmersiveDashboardNav`. Record direct callers, affected flows, and HIGH/CRITICAL warnings before editing.

### Task 2: Add accessible transient notifications

**Files:**
- Create: `components/feedback/ToastProvider.tsx`
- Create: `tests/components/ToastProvider.test.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/ui-refinement.css`

**Interfaces:**
- Produces: `useToast(): { success(message: string): void; error(message: string): void; info(message: string): void }`.
- Produces: root live region with close, bounded stack, pause/resume, and reduced-motion behavior.

- [ ] **Step 1: Write failing toast behavior tests**

Add tests that render a harness under `ToastProvider`, call `success("Role updated.")`, assert a bottom-right `role="status"` item and close button, advance fake timers by 5000 ms to assert removal, and verify hover pauses the timer.

- [ ] **Step 2: Verify the tests fail for the missing provider**

Run `npm test -- tests/components/ToastProvider.test.tsx`. Expected: FAIL because `ToastProvider` does not exist.

- [ ] **Step 3: Implement the minimal provider and styles**

Implement typed toast records, a maximum visible stack of three, 5-second success/info duration, 9-second error duration, close buttons, timer pause/resume, `aria-live`, and viewport-safe positioning. Wrap `RootLayout` body contents with the provider.

- [ ] **Step 4: Verify the focused tests**

Run `npm test -- tests/components/ToastProvider.test.tsx`. Expected: PASS with no timer or act warnings.

### Task 3: Correct collaborator and finding mutation state

**Files:**
- Modify: `components/workspaces/CollaboratorControls.tsx`
- Modify: `app/dashboard/workspace/actions.ts`
- Modify: `components/findings/FindingLifecycleControls.tsx`
- Modify: `tests/components/CollaboratorControls.test.tsx`
- Modify: `tests/components/FindingLifecycleControls.test.tsx`

**Interfaces:**
- Consumes: `useToast` from Task 2.
- Produces: `manageCollaborator` success results containing the authoritative operation, collaborator ID when present, and role when present.

- [ ] **Step 1: Add a failing collaborator regression test**

Render a `viewer`, rerender the same `user_id` as `member`, and assert the role combobox changes to `Member`. Add a mutation test asserting a successful server result immediately updates the controlled combobox and emits `Role updated.` without an inline status banner.

- [ ] **Step 2: Add a failing lifecycle synchronization test**

Mock a successful `resolve` action, submit a required note, and assert `router.refresh()` plus one success toast. Assert no persistent `.authMessage` success node remains.

- [ ] **Step 3: Verify both regressions fail for the confirmed mechanisms**

Run `npm test -- tests/components/CollaboratorControls.test.tsx tests/components/FindingLifecycleControls.test.tsx`. Expected: collaborator rerender remains stale and lifecycle does not refresh or toast.

- [ ] **Step 4: Implement authoritative state reconciliation**

Replace uncontrolled role selects with state keyed by `user_id`, reconcile on `members` changes, update from the mutation result, retain the prior value on errors, and refresh server content after success. Migrate lifecycle success/error feedback to toasts and refresh canonical finding content.

- [ ] **Step 5: Verify focused tests pass**

Run the two component test files. Expected: PASS.

### Task 4: Normalize the complete application visual system

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/product-ui.css`
- Modify: `components/AppShell.tsx`
- Modify: `components/ImmersiveDashboardNav.tsx`
- Modify: `components/SideNav.tsx`
- Modify: `app/dashboard/findings/[findingId]/page.tsx`
- Modify: `app/dashboard/workspace/workspace.css`
- Test: `tests/architecture/product-ui-contract.test.ts`
- Test: `tests/components/SideNav.test.tsx`

**Interfaces:**
- Produces: final cascade layer imported last by `RootLayout` and shared account-security navigation.
- Preserves: current route names, authorization boundaries, public footer, CSP, safe-area handling, and no-horizontal-scroll behavior.

- [ ] **Step 1: Write failing structural and navigation tests**

Assert `product-ui.css` is imported last, the dashboard navigation exposes `Account & security`, lifecycle/remediation/retest controls share one workflow-field contract, and the final CSS includes responsive rules for 390, 768, 1024, and 1440-class layouts without fixed page-width overflow.

- [ ] **Step 2: Verify contract tests fail**

Run `npm test -- tests/architecture/product-ui-contract.test.ts tests/components/SideNav.test.tsx`. Expected: FAIL because the final layer and security link are absent.

- [ ] **Step 3: Implement shared tokens and layout corrections**

Load the product font through `next/font`, add consistent type/spacing/control/card tokens, start-align dashboard grids, generalize workflow field styles, improve collaborator rows, add visible focus states, create compact mobile navigation, and retain at least 44 px interactive targets.

- [ ] **Step 4: Verify component and architecture tests**

Run the two focused test files plus existing navigation, CSP, admin-responsive, and public-footer tests. Expected: PASS.

### Task 5: Add non-enumerating password recovery and password controls

**Files:**
- Create: `app/auth/forgot-password/page.tsx`
- Create: `app/auth/update-password/page.tsx`
- Create: `components/auth/ForgotPasswordForm.tsx`
- Create: `components/auth/UpdatePasswordForm.tsx`
- Create: `lib/auth/password.ts`
- Modify: `components/AuthForm.tsx`
- Modify: `app/auth/confirm/route.ts`
- Test: `tests/auth/password.test.ts`
- Test: `tests/components/PasswordRecovery.test.tsx`
- Modify: `tests/auth/routes.test.ts`

**Interfaces:**
- Produces: `validateNewPassword(password, confirmation)` with bounded user-safe errors.
- Produces: recovery redirect `/auth/update-password` and identical successful request copy for every email.

- [ ] **Step 1: Write failing validation and recovery tests**

Test missing, short, mismatched, and valid passwords; test that reset requests always render `If an account exists...`; test recovery confirmation routes to `/auth/update-password`; and test the sign-in page exposes `Forgot password?`.

- [ ] **Step 2: Verify the tests fail because routes and helpers are absent**

Run the three focused test files. Expected: FAIL on missing modules/routes and missing link.

- [ ] **Step 3: Implement recovery and update flows**

Call `resetPasswordForEmail` with a same-origin callback, never branch visible copy on account existence, require a recovery session before update, validate matching inputs, call `updateUser`, and use correct autocomplete attributes.

- [ ] **Step 4: Verify focused recovery coverage**

Run the three focused test files. Expected: PASS with no raw provider message assertions.

### Task 6: Add the account security page and TOTP AAL2 flow

**Files:**
- Create: `app/dashboard/settings/security/page.tsx`
- Create: `components/auth/AccountSecurityPanel.tsx`
- Create: `app/auth/mfa/page.tsx`
- Create: `components/auth/MfaChallengeForm.tsx`
- Create: `lib/auth/assurance.ts`
- Modify: `lib/workspaces/current.ts`
- Modify: `lib/platform-admin/authorization.ts`
- Test: `tests/auth/assurance.test.ts`
- Test: `tests/components/AccountSecurityPanel.test.tsx`
- Test: `tests/components/MfaChallengeForm.test.tsx`

**Interfaces:**
- Produces: `readAssuranceState(auth): Promise<{ currentLevel; nextLevel; verifiedTotp; unverifiedTotp }>`.
- Produces: owner/admin enrollment redirect and enrolled-factor challenge redirect.

- [ ] **Step 1: Write failing assurance-policy tests**

Cover viewer/member without factors, owner without a verified factor, owner at AAL1 with a verified factor, owner at AAL2, and platform administrator at AAL1. Assert privileged users are directed to enrollment or challenge while AAL2 proceeds.

- [ ] **Step 2: Write failing enrollment/challenge component tests**

Assert enrollment does not report success before code verification, invalid codes preserve bounded guidance, successful challenge redirects only after AAL2, and factor removal requires explicit confirmation.

- [ ] **Step 3: Verify the tests fail for missing policy and components**

Run the three focused files. Expected: FAIL on missing modules.

- [ ] **Step 4: Implement native Supabase TOTP flows**

Use `mfa.enroll`, `mfa.challenge`, `mfa.verify`, `mfa.listFactors`, and `mfa.unenroll`. Add server-side assurance checks to privileged workspace/admin entry points while excluding recovery and MFA routes from redirect loops.

- [ ] **Step 5: Verify focused TOTP and authorization coverage**

Run the three new files plus existing workspace permission, platform-admin authorization, and auth-boundary tests. Expected: PASS.

### Task 7: Add capability-checked Supabase passkeys

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `lib/supabase/client.ts`
- Create: `components/auth/PasskeySignIn.tsx`
- Create: `components/auth/PasskeyManager.tsx`
- Modify: `components/AuthForm.tsx`
- Modify: `components/auth/AccountSecurityPanel.tsx`
- Test: `tests/components/PasskeySignIn.test.tsx`
- Test: `tests/components/PasskeyManager.test.tsx`
- Modify: `tests/architecture/phase-9a-auth-boundary.test.ts`

**Interfaces:**
- Consumes: Supabase JS version `>=2.105.0` with `auth.experimental.passkey` enabled.
- Produces: passkey sign-in plus authenticated list/register/rename/delete controls.

- [ ] **Step 1: Write failing capability and fallback tests**

Assert supported browsers expose passkey sign-in, unsupported browsers retain password sign-in, provider-disabled errors produce bounded guidance, successful sign-in reaches the dashboard, and passkey deletion requires explicit confirmation.

- [ ] **Step 2: Verify tests fail before the dependency/API update**

Run the two passkey component tests. Expected: FAIL because the components and enabled API are absent.

- [ ] **Step 3: Upgrade the Supabase client and implement passkey controls**

Install the current reviewed Supabase JS version at or above `2.105.0`, explicitly enable the experimental passkey client option, use `signInWithPasskey`, `registerPasskey`, and the passkey list/update/delete methods, and preserve password/TOTP fallback.

- [ ] **Step 4: Verify passkey and auth-boundary tests**

Run the two focused files and the Phase 9A auth-boundary test. Expected: PASS.

### Task 8: Migrate remaining mutation feedback and verify every route

**Files:**
- Modify: mutation-capable components under `components/assets/`, `components/findings/`, and `components/admin/` identified by `setMessage`/`authMessage` search.
- Test: corresponding component tests under `tests/components/`.
- Create: `docs/validation/post-v1/PRODUCT_UX_AUTH_ACCEPTANCE.md`

**Interfaces:**
- Consumes: `useToast` and the approved inline-message distinction.
- Produces: route/role/state/viewport evidence table with pass/fail status and exact screenshots or commands.

- [ ] **Step 1: Enumerate every mutation message and route**

Run repository searches for client mutation handlers and `.authMessage`, then classify each as transient toast, field validation, blocking error, empty state, or persistent guidance. Record all route entries from `app/**/page.tsx`.

- [ ] **Step 2: Add failing tests for each migrated success path**

For each transient success handler, assert a toast is emitted and no persistent success banner remains. Preserve inline field and blocking error tests.

- [ ] **Step 3: Implement the remaining feedback migrations**

Use the shared toast API and authoritative refresh behavior without altering the underlying authorization or service calls.

- [ ] **Step 4: Run focused and neighboring tests**

Run every modified component test plus workspace, finding, asset, integration, admin, CSP, responsive, and auth architecture tests. Expected: PASS.

- [ ] **Step 5: Perform rendered route and viewport verification**

Use the authenticated browser and safe reversible data to execute the spec matrix at 390x844, 768x1024, 1024x768, and 1440x900. Record horizontal overflow, keyboard focus, visible labels, success/error feedback, and canonical state refresh. Do not alter protected roles or durable Phase 11 evidence.

### Task 9: Broad verification, GitNexus refresh, and release

**Files:**
- Modify: `.gitnexus/` tracked outputs generated by analysis.
- Modify: `AGENTS.md` and `CLAUDE.md` only when generated by GitNexus and after verifying no user-owned changes are overwritten.
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/LATEST_SESSION.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/UNFINISHED_WORK.md`

**Interfaces:**
- Produces: exact-branch verification, reviewed PR, exact-head CI, merged deployment, and production smoke evidence.

- [ ] **Step 1: Run the broad local gate**

Run focused tests, the full `npm test` suite, `npm run typecheck`, `npm run build:cli`, `npm run build:workers`, `npm run build`, and `git diff --check`. Re-run known baseline timeout tests serially and classify any remaining failure exactly.

- [ ] **Step 2: Run GitNexus change detection before commit**

Run GitNexus changed-symbol detection against the working tree. Expected: only UI, auth, workspace, findings, navigation, and documentation flows are affected. Stop on unexpected worker, scanner, provider, or containment flows.

- [ ] **Step 3: Refresh and include GitNexus output**

Run `npx gitnexus analyze --force`, then `npx gitnexus status`. Inspect `.gitnexus/`, generated `AGENTS.md`, and generated `CLAUDE.md`; stage only the final-index outputs and preserve unrelated user work.

- [ ] **Step 4: Update handoff and acceptance documentation**

Record exact commands, test counts, unresolved limitations, provider configuration status, screenshots, branch, SHA, PR, and deployment state. Mark post-v1 UX/auth work complete only where direct evidence exists.

- [ ] **Step 5: Commit, push, open the PR, and wait for exact-head CI**

Create focused commits without AI co-author attribution, push `feat/post-v1-ux-auth-security`, open a PR against live `main`, and verify the required exact-head checks. Address only confirmed failures.

- [ ] **Step 6: Merge and verify production**

After green exact-head CI and review, merge through the repository's allowed method, verify the exact-main Vercel deployment reaches READY, then execute the production browser matrix's critical paths. Provider passkey enablement requires verified `scopeforge.dev` relying-party configuration before its production path is marked accepted.

## Self-review record

- Spec coverage: every approved UX, notification, role-state, password, TOTP, passkey, whole-app test, GitNexus, release, and rollback requirement maps to Tasks 2-9.
- Placeholder scan: no deferred implementation markers are used.
- Type consistency: toast, assurance, collaborator result, and passkey interfaces are introduced before their consumers.
- Review focus: all five high-risk cases have explicit tests in their owning task.

