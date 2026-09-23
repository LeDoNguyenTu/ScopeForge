# Product UX and account security design

Status: approved for implementation.
Date: 2026-09-23

## Goal

Turn the completed ScopeForge v1 backend into a coherent, accessible product experience across every public, authentication, workspace, finding, asset, resource, integration, and administrative surface. Correct stale client state, replace persistent inline success messages with transient notifications, and add complete password recovery and account-security controls without weakening the existing authorization or database boundaries.

## Product principles

- Operational clarity comes before visual decoration. Each screen must expose its primary task, current state, and next action without requiring security-domain knowledge.
- Server state remains authoritative. Optimistic UI may improve responsiveness, but refreshed server data must reconcile the final displayed value.
- Success feedback is transient and non-blocking. Errors remain visible long enough to act on and are never conveyed by color alone.
- Security controls fail closed. The new UI must not bypass workspace roles, platform-admin checks, RLS, target verification, containment, budgets, CSP, or worker boundaries.
- Responsive behavior is designed at 390 px, 768 px, 1024 px, and 1440 px viewports. No supported route may create horizontal page scrolling.
- Interactive controls have a minimum 44 px target, visible keyboard focus, explicit labels, and accessible status announcements.

## Approved authentication model

ScopeForge continues to use Supabase Auth.

1. Passkeys are the preferred phishing-resistant sign-in path. Supabase's experimental passkey API is enabled in the browser client only after the dependency supports it and the production relying-party configuration is verified for `scopeforge.dev`.
2. A passkey is passwordless authentication, not a fabricated second factor. The UI must describe it accurately.
3. Password sign-in followed by a verified authenticator-app TOTP is the supported AAL2 flow.
4. Email OTP and password-reset email are recovery or passwordless AAL1 mechanisms. They must not be represented as AAL2.
5. Workspace owners and platform administrators must enroll and satisfy AAL2 for privileged access. Members and viewers may enroll voluntarily and are challenged whenever their account has a verified factor.
6. Users who cannot satisfy an enrolled factor are routed to recovery guidance rather than receiving a bare authorization error.
7. Provider errors, credential identifiers, challenge material, session tokens, and recovery links must not appear in ordinary logs, browser-visible diagnostics, or analytics.

## UX foundation

### Typography and density

- Use one loaded product font with a system fallback and font smoothing.
- Default body copy is 15-16 px with at least 1.5 line height.
- Labels and supporting copy are at least 12 px, with ordinary form labels at 13-14 px.
- Dashboard page titles use a consistent 32-36 px responsive scale.
- Use tabular numbers for metrics and monospace only for technical identifiers.

### Layout

- The application shell uses a fixed desktop navigation rail and a usable compact mobile navigation treatment.
- Content width, page padding, card radius, and vertical rhythm come from shared tokens.
- Grid children align to the start by default so a short workflow card does not stretch to match an unrelated long detail card.
- Forms stack label, control, help text, and validation text. No label/control/help text may share a cramped inline row.
- Destructive actions are visually separated from primary actions and require the existing confirmation boundary.

### Notifications

A root `ToastProvider` owns a bottom-right live region.

- Success and informational toasts dismiss after 5 seconds.
- Error toasts dismiss after 9 seconds unless the user closes them sooner.
- Every toast has a close button.
- Timers pause while hovered or keyboard-focused.
- At most three visible toasts are stacked; newer messages replace the oldest overflow entry.
- Reduced-motion preferences remove translation animation.
- Toasts never contain secrets or raw provider errors.

Inline messages remain only when they are page-state content: validation attached to a field, a blocking error requiring remediation, an empty state, or persistent security guidance.

## Confirmed defect corrections

### Collaborator role state

`CollaboratorControls` currently renders each role select with `defaultValue`. React preserves that uncontrolled value when the server refresh supplies a new `member.role`, producing the observed `viewer` text beside a control stuck on `Member`.

The control becomes authoritative local state keyed by `user_id`. A successful mutation updates that state from the server action result and then refreshes the route. Prop changes reconcile local state. Failure preserves the previous role and produces an error toast.

### Finding workflow layout and state

The lifecycle note field is missing the styles that are incorrectly scoped only beneath the remediation panel. Shared workflow-field styles apply to lifecycle, remediation, and retest panels. Successful lifecycle changes refresh the route so summary cards, available actions, event history, and guidance agree with the canonical database state.

## Account and security surfaces

### Navigation

The signed-in identity area links to `/dashboard/settings/security`. The security page shows the confirmed account email, password controls, passkeys, authenticator factors, current assurance state, and recovery guidance.

### Password recovery

- `/auth/forgot-password` accepts an email address and calls `resetPasswordForEmail` with a local `/auth/update-password` redirect.
- The success response is identical whether or not an account exists.
- `/auth/update-password` requires a recovery session, validates matching password fields, and calls `updateUser`.
- Signed-in password changes request and validate the current password where supported.
- Password submission is never logged and password inputs use correct autocomplete attributes.

### TOTP MFA

- Enrollment begins only from an authenticated security page.
- The QR/secret is shown only during enrollment and is not persisted by ScopeForge.
- The first valid code verifies enrollment before the factor is treated as active.
- Sign-in detects `currentLevel = aal1` and `nextLevel = aal2`, then routes to `/auth/mfa`.
- Factor challenge and verification upgrade the session to AAL2 before protected navigation continues.
- Factor removal requires an AAL2 session and an explicit confirmation.

### Passkeys

- Sign-in offers `Continue with a passkey` before the password form when the browser supports WebAuthn.
- Security settings list, register, rename, and revoke passkeys through Supabase Auth.
- Unsupported browsers and disabled provider configuration receive bounded guidance and retain password/TOTP access.
- The relying-party ID is `scopeforge.dev`; changing it after enrollment is a breaking credential operation and is outside this change.

## Whole-product verification matrix

The implementation is not accepted from screenshots alone. Verification covers:

- public: landing and resources;
- authentication: sign-up, sign-in, confirmation result, forgotten password, password update, passkey entry, MFA challenge;
- workspace: overview, asset list, asset creation, asset detail, findings list, finding detail, resources, GitHub integration, collaborators, security settings;
- administration: dashboard, users, user detail, workspaces, audit, settings, and Phase 11 read-only state;
- roles: unauthenticated, viewer, member, owner, and platform administrator;
- states: populated, empty, loading/pending, success, validation failure, authorization failure, provider failure, and not-found;
- viewports: 390x844, 768x1024, 1024x768, and 1440x900;
- interaction: keyboard-only navigation, focus visibility, live-region announcements, dialog/confirmation behavior, and absence of horizontal overflow;
- functional workflows: collaborator role update, collaborator removal cancellation, workspace switching, asset create validation, finding lifecycle update, remediation save, retest eligibility, sign-out, password recovery request, password update validation, TOTP enrollment/challenge, and passkey capability handling.

Production verification uses reversible test data and the existing authorized session. It must not delete durable production evidence, change protected memberships, run Phase 11 canaries, or alter worker/provider authority.

## Release and rollback

Because this change modifies executable authentication and authorization-adjacent behavior, exact-head CI is required. Provider configuration is verified separately against the ScopeForge Supabase project `tdgpibrepzcvdivztkta`. The release is accepted only after exact-main deployment readiness and rendered production smoke checks.

Rollback is application-first: revert the feature commit while leaving existing Supabase identities and factors intact. No destructive migration is part of this design. Passkey provider enablement can remain on because old clients ignore it; it must not be disabled if users have already enrolled credentials without a separate migration and communication plan.

