# Product UX and account security acceptance

Candidate: `feat/post-v1-ux-auth-security`, rebased onto live `main` `d74adff99b9d13871afe73ba05d74d715597f5db` (exact head is recorded by the PR and final handoff).

## Scope and invariants

- Reviewed every `app/**/page.tsx` route, the shared public/auth/workspace/admin shells, and mutation-capable asset, finding, integration, workspace, and account-security controls.
- Password recovery uses non-enumerating copy. Email OTP remains AAL1. Password plus verified TOTP is the supported AAL2 path.
- Passkeys are a preferred phishing-resistant primary sign-in method and do not replace the TOTP step for privileged sessions.
- Existing authorization, RLS, CSP, target verification, containment, worker boundaries, network restrictions, and runtime budgets are unchanged.
- No Phase 11 canary was run or modified by this work.

## Route inventory

| Surface | Routes | Required states |
| --- | --- | --- |
| Public | `/`, `/resources` | anonymous; desktop/mobile |
| Authentication | `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/update-password`, `/auth/mfa`, `/auth/result` | password, recovery, passkey-capability fallback, TOTP challenge, invalid/expired response |
| Workspace | `/dashboard`, `/dashboard/assets`, `/dashboard/assets/new`, `/dashboard/assets/[assetId]`, `/dashboard/findings`, `/dashboard/findings/[findingId]`, `/dashboard/integrations/github`, `/dashboard/resources`, `/dashboard/workspace`, `/dashboard/settings/security` | owner, admin, member, viewer; empty/populated/error; AAL1/AAL2 |
| Platform admin | `/admin`, `/admin/users`, `/admin/users/[userId]`, `/admin/workspaces`, `/admin/audit`, `/admin/settings`, `/admin/phase11` | authorized AAL2, unauthenticated, denied |
| Service and previews | `/maintenance`, `/preview/dashboard`, `/preview/workspace`, `/preview/admin` | maintenance copy; representative shell rendering |

## Feedback classification

| Kind | Presentation |
| --- | --- |
| Successful collaborator, lifecycle, remediation, retest, snapshot, project-scan, import, password, passkey, and MFA mutations | Bottom-right dismissible toast; success/info expires after 5 seconds |
| Recoverable mutation or field errors | Inline next to the originating control; error toasts persist for 9 seconds where global context is more useful |
| Job terminal state, target-verification reason, empty state, guardrail, and security guidance | Persistent inline content |

## Automated evidence

| Gate | Result |
| --- | --- |
| Toast behavior | 4/4 passed, including close, expiry, hover pause, and bounded stack |
| Collaborator/lifecycle synchronization | Passed; authoritative role and finding state refresh without persistent success banners |
| Recovery/password/TOTP/passkey focused tests | Passed; provider details remain bounded and Turnstile is retained for passkeys |
| Product UX neighboring gate | 614/614 passed across components, auth, workspaces, platform admin, product UI, findings, remediation, snapshots, project scans, and imports |
| TypeScript | `npm run typecheck` passed |
| Dependency audit | 0 vulnerabilities after the reviewed Supabase SDK update |
| Full repository suite | 2,325 passed, 26 skipped; two known Windows parallel timeout failures both passed in a 4/4 serial rerun |
| Builds | Typecheck, CLI build, worker bundles, and 42-route Next production build passed |
| GitNexus | Refreshed: 18,283 nodes, 30,033 edges, 781 clusters, 300 flows |

## Rendered acceptance matrix

The final exact-deployment rows are populated only after the candidate is deployed. A row is not accepted from source review alone.

| Viewport | Public/auth | Workspace shell | Account security | Platform admin | Horizontal overflow | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 390x844 | Pending exact deployment | Pending exact deployment | Pending exact deployment | Pending exact deployment | Pending | Pending |
| 768x1024 | Pending exact deployment | Pending exact deployment | Pending exact deployment | Pending exact deployment | Pending | Pending |
| 1024x768 | Pending exact deployment | Pending exact deployment | Pending exact deployment | Pending exact deployment | Pending | Pending |
| 1440x900 | Pending exact deployment | Pending exact deployment | Pending exact deployment | Pending exact deployment | Pending | Pending |

## Provider-dependent evidence

- TOTP enrollment and challenge use the configured Supabase Auth project and require an authenticated account. Production acceptance must verify enrollment, AAL1 challenge, AAL2 continuation, and factor removal without recording QR secrets or codes.
- Passkey UI and safe fallback are implemented and tested. Production acceptance additionally requires the Supabase project to expose passkeys for `scopeforge.dev` with the relying-party configuration verified.
