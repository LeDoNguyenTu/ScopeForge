# Signup confirmation repair - 2026-09-16

## Scope and current state

Branch: `fix/signup-confirmation-flow-20260916`, based on main `c49e3c5`.
PR #116 is already merged; its acceptance record remains authoritative for uploader expiry. Issue #79 is still open, then release #76 before #77.

The user reported retained signup credentials after email submission and a confirmation redirect to localhost. Source omitted `emailRedirectTo`; live ScopeForge Supabase Auth Site URL was `http://localhost:3000`, with no allowed redirect URLs. The user-designated collaborator's email was already confirmed and had one workspace membership. Do not recreate or manually confirm that account, fabricate memberships, or downgrade its existing owner membership.

## Implementation and evidence

- Test-only commit `f3b7895` reproduces missing redirect configuration, retained form, and missing bounded confirmation outcomes. Initial focused run: 9 failures / 11 passes; intended signup and route assertions failed. One unsupported-type test initially had an incomplete mock, corrected in the test-only commit; do not count that initial mock failure as RED evidence.
- Signup clears name, email, password and captcha state, then replaces the form with a separate Check your email card. Returning to signup starts empty and requires fresh configured captcha verification.
- Callback and token-hash routes produce bounded success/invalid/expired/error results; existing safe local return paths remain supported. Success presentation requires a server-verified confirmed user.
- Standard provider error fragments are recognized without rendering provider descriptions and are removed from browser history. Redirect responses are no-store/no-referrer.
- Focused implementation checks: 4 files / 27 tests passed. Full tests, builds, exact-candidate CI and browser acceptance are pending until recorded below.

## Provider rollout

After the validated application is deployed, set Site URL to `https://scopeforge.dev` and allow exact `https://scopeforge.dev/auth/callback` in project `tdgpibrepzcvdivztkta`. Verify saved values by reloading. Do not change confirmation/captcha/security flags.

Current Supabase free email service locks template editing behind custom SMTP or an upgrade. Keep its standard template; no purchase or email-delivery migration is needed for this repair. Existing emails containing localhost redirects cannot be changed retroactively. The already-confirmed collaborator can sign in normally.

## Remaining release blocker

Issue #79 still needs real unrelated-installation and normal-member negative provider canaries. GitHub owner passkey confirmation was completed earlier; existing installation settings do not by themselves supply a fresh signed callback. No Phase 10A2/10A3 migrations or worker gates are authorized to advance before their acceptance sequence.

The collaborator identity is now known from the user's instruction; obtain its normal authenticated application session and use legitimate workspace onboarding without changing its own workspace ownership. A public handoff must not include the collaborator's email, auth codes, signed state, tokens, or secrets.
