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

## Release evidence and next UI task

- PR #117 merged as `12a2609458d8b4c7369e2bb7d4926dd686a84769`.
- Exact PR head `388d05e4f667df6fc5d1687536b2cabbbfd09e75`: CI run `35015136780` passed 401 files / 1775 tests with no skips, audit (zero vulnerabilities), typecheck, CLI/version, both benchmarks, Next build, responsive/CSP browser smoke, and production UI diagnostic.
- Windows full suite: 1751 passed / 24 platform-specific skips. Local audit, typecheck, CLI, benchmarks and Next build passed. A local runtime smoke lacked Supabase environment variables; deployed preview and CI browser checks provided the runtime evidence.
- Candidate preview `dpl_GHWZHab3Ykt1YhAthZzYte3BHMN6` READY. Actual desktop and 390px mobile result screenshots reviewed. Standard provider expired fragment redirected correctly and was stripped.
- Production deployment `dpl_5QLmhM2ztPJuJ8PYrjeEcKBTh8Qu` READY on merge SHA, with `scopeforge.dev` alias. Production expired-result page rendered successfully.
- ScopeForge Supabase Site URL saved as `https://scopeforge.dev`, exact redirect `https://scopeforge.dev/auth/callback` saved and verified after dashboard reload. No template, confirmation, captcha, migration, or worker-gate changes were made for this repair.
- A newly delivered confirmation email has not yet been exercised end to end; do not claim mailbox delivery proof from route tests. Already-issued localhost links cannot be rewritten.
- The user explicitly chose Brian's workspace for the designated collaborator. A guarded, idempotent membership insert added role `member`; readback confirmed existing Meo workspace `owner` membership remains unchanged. This legitimate onboarding is not negative-canary evidence.
- The user then requested the missing collaborator-control UI. Current app has no member-management UI or workspace switcher, and several paths implicitly select the first membership. Next work is a scoped management page and consistent, server-validated workspace selection before the normal-member provider canary. Do not reorder membership timestamps or downgrade owners to make that canary pass.
