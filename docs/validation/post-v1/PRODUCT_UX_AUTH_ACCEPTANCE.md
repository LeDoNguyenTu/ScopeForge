# Product UX and account security acceptance

Released by PR #186: exact head `3802f6247ef267716de0e29320668b449dff3328`, merge `c921b9d37e47c2e5bf7b031bab4432cdb9ed8662`, exact-head CI run `35822369679`, Vercel deployment `E5gKbj7eoFjSTyMYVkQ7LUwi454A`.

Rendered follow-up PR #187: exact head `783d40102ea86ebdaee9b9646b3ad1e2132d10f7`, merge `25aa2a46ce34c446f500f036787f37d9acbf5310`, exact-head CI run `35823763535`, Vercel deployment `8nZYDQG7v2BFuo3wrYxKBiWvCFia`.

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

Authenticated production rendering confirmed the new security shell and provider-backed factor inventory. The Chrome profile's zoom was accounted for when setting the final effective CSS viewports. The first narrow render exposed an overly tall mobile workspace navigation list; PR #187 fixed it, and the exact deployed CSS now reports a row flex direction, one shared link top coordinate, bounded horizontal nav scrolling, and no document-level overflow.

| Viewport | Public/auth | Workspace shell | Account security | Platform admin | Horizontal overflow | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 391x844 effective | Landing and recovery rendered | Compact horizontal nav verified | Security page rendered | Shared AAL2 guard/tests | None | Accepted |
| 768x1024 effective | Automated route coverage | Compact horizontal nav verified | Security page rendered | Shared AAL2 guard/tests | None | Accepted |
| 1024x768 effective | Automated route coverage | Workspace redirected to required MFA | Security page rendered | Admin redirected to required MFA | None | Accepted |
| 1440x900 effective | Landing rendered | Desktop shell covered by release rendering | Security/passkeys rendered | Shared AAL2 guard/tests | None | Accepted |

## Provider-dependent evidence

- TOTP enrollment and challenge use the configured Supabase Auth project and require an authenticated account. Production acceptance must verify enrollment, AAL1 challenge, AAL2 continuation, and factor removal without recording QR secrets or codes.
- Production factor inventory returned successfully on `scopeforge.dev` and rendered `No passkeys registered yet`, confirming live passkey provider capability without creating a persistent credential.
- TOTP enrollment/challenge/removal remain automated-test accepted. The browser smoke deliberately did not enroll or remove the user's factor, expose a QR secret, submit an OTP, or change a password.
