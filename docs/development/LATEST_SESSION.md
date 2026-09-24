# ScopeForge Latest Session

Last reconciled: 2026-09-24, Asia/Singapore. Live GitHub and provider state wins.

## Dashboard usability and MFA follow-up in progress

Live `origin/main` was verified at `86c20e8c9a440f9d604a180db82288d8cc18608d`; the isolated worktree is `D:\PROJECTS\ScopeForge-dashboard-ux` on `fix/dashboard-onboarding-ux`. The primary checkout's unrelated local GitNexus metadata edits remain untouched.

The candidate makes platform administrators the only roles required to enroll MFA. Workspace roles get a dismissible recommendation, but an already-enrolled authenticator still requires an AAL2 challenge for every role. Required enrollment now transitions to `/dashboard` automatically after verification, and stale required-enrollment URLs recover without a manual refresh.

Dashboard and asset usability corrections replace the decorative map with factual asset cards, disclose disabled website-worker capability before an action is offered, remove website-only panels from repository assets, and make local JSON import clearly optional and understandable. Rendered review covered the current authenticated production dashboard and a built local populated preview at desktop and 390x844. Production was read-only; no scan, factor, password, role, platform setting, migration, or Phase 11 canary was created.

Validation so far: focused auth/UI/architecture tests pass, typecheck passes, and the production build passes. A broad Windows regression run excluding the two Linux-only Phase 12 path/shell suites passed 2,413 tests with 26 skips. Those suites deterministically reject Windows-normalized paths while exercising Linux socket and Bash contracts, and no WSL distribution is installed. Run exact-head Linux CI before merge. GitNexus change detection reports critical reach because the central assurance policy affects 23 execution flows; the explicit role matrix and page tests cover the intended boundary.

## Product UX and account security release

The post-v1 UX/auth candidate on `feat/post-v1-ux-auth-security` was reconciled onto live `main` `d74adff99b9d13871afe73ba05d74d715597f5db` after Phase 12A PR #185 merged. Completed implementation includes:

- controlled collaborator roles plus canonical refresh after mutations;
- bottom-right, dismissible, auto-expiring toasts across workspace mutation workflows;
- responsive typography, spacing, form, finding-detail, workspace, auth, and navigation refinement;
- forgot-password/recovery and authenticated password change controls;
- native Supabase TOTP enrollment/challenge/removal with default-on AAL2 enforcement for owners, admins, and platform administrators;
- experimental Supabase passkey sign-in and management with password/TOTP fallback and Turnstile preservation.

Local gate: 2,325 tests passed; the two expected Windows parallel timeout failures passed 4/4 serially. Typecheck, CLI, worker, and Next production builds passed. GitNexus is current. Acceptance record: `docs/validation/post-v1/PRODUCT_UX_AUTH_ACCEPTANCE.md`.

PR #186 passed exact-head CI run `35822369679`, merged as `c921b9d37e47c2e5bf7b031bab4432cdb9ed8662`, and reached a successful Vercel production deployment. Authenticated production rendering confirmed the Account & security route, owner AAL2 enforcement, TOTP enrollment control, passkey provider capability, password controls, and zero horizontal document overflow. The rendered check exposed an overly tall mobile workspace navigation list; PR #187 added the scoped `flex-direction: row` correction and regression test, passed exact-head CI run `35823763535`, merged as `25aa2a46ce34c446f500f036787f37d9acbf5310`, and deployed successfully. The final effective 391x844, 768x1024, 1024x768, and 1440x900 production matrix passed. No Phase 11 canary was run.

Four production follow-ups are also released:

- PR #189 (`5175a18d3f5da4ee328c2f5a612201da990e7fe8`) recovers interrupted TOTP enrollment without exposing factor secrets. Exact-head CI run `35848037777` and exact-merge Vercel deployment `8uC7ySr9BufGHFjX8XHRcxkvuzN1` passed.
- PR #190 (`25a080de0dde67a8f321fda43467cfa2b367de19`) renders the Supabase TOTP QR value as a browser-safe data URL while preserving the adjacent copyable manual setup key. Exact-head CI run `35852626900` and exact-merge Vercel deployment `8C7XWy5EVCNK7GTa55Wgx56oqvNR` passed.
- PR #191 (`4a4748a72bc4b61adae98c5248324539ce738ad1`) limits blocking MFA enforcement to workspace owners/admins and platform administrators. Members/viewers receive a dismissible recommendation instead. Privileged AAL1 sessions cannot escape the challenge through the security settings route. Exact-head CI run `35857384190` and exact-merge Vercel deployment `3y4yE3Zq5mPjuXRm1ykTFFd3BDgA` passed.
- PR #194 (`4aaecc559d7617a6e1879b235efe296cdb798296`) adds a globally synchronized maintenance completion instant, administrator-selected IANA display zone, live countdown, automatic/manual expiry control, and separated maintenance-page actions. Exact-head CI run `35906145711` and exact-merge Vercel deployment `GFbcReM691PphXmH6u85163qKtCN` passed.

Production migration `20260923185307_maintenance_window_scheduling` is registered on ScopeForge Supabase `tdgpibrepzcvdivztkta`. The current authoritative state remains maintenance disabled, no completion instant or time-zone override, and automatic expiry enabled. The new columns expose SELECT-only access to `anon` and `authenticated`; no mutation grant or security-boundary relaxation was added. `/maintenance` returns a 307 redirect to `/` while the mode is disabled.

Final authenticated production rendering confirmed the owner session at AAL2, the verified authenticator and passkey inventory, and the complete `/admin/settings` maintenance form without changing any factor or platform setting. A final read-only database reconciliation reconfirmed the accepted Phase 11 run as `completed / request_budget_exhausted`, exactly one request, zero provider failures, zero graph expansions, one accepted observation, zero active Phase 11 tasks, and the dedicated worker enabled.

## Phase 11 accepted

The separately authorized fifth bounded production canary completed through the normal authenticated admin, policy, queue, worker, mediator, and sandbox path.

- run: `37fb0091-a7b2-4a33-8a24-6136deb61143`
- action: `phase11-action:dccb7c2dfc471218d15f53d4f01b44f6f53cc40b64e8a4a8dd8847c13adc354c`
- task: `1e6d3df7-c1b2-40e9-ba68-704c3fdda12e`
- worker/action attempt: `8c03e311-56c0-4b33-8520-682cb335cd5c`
- observation: `phase11-obs-http:79a7ccee5eee6751f948ebd2bee1954f07f2b71a33e49b890b33278ac267f7bb`
- evidence: `phase11-http-attempt:8c03e311-56c0-4b33-8520-682cb335cd5c:root`
- database verdict: `acceptance_ready = true`
- accounting: exactly one request, zero provider failures, zero graph expansions
- terminal state: run `completed / request_budget_exhausted`; task completed; action terminal and approved
- Vercel: prepare and finalize HTTP 200; no canary-window runtime error cluster
- Oracle: `PHASE11_HOST_CLEANUP_PASS`; no exact container or mediator socket remained
- final database state: zero active Phase 11 tasks; dedicated worker enabled

PR #182 and forward-only migration `20260922150155_complete_clean_budget_exhaustion` are the released terminal-semantics correction. The four earlier failed canaries remain unchanged as audit evidence. Do not run another Phase 11 acceptance canary merely to reconfirm the completed gate.

The temporary public verification proof was removed only after successful acceptance.

## Progress

- Phase 11 source: 100%
- Phase 11 operational acceptance: 100%
- Phase 11 completion task: 100%
- approved ScopeForge v1 roadmap: 100% (11 of 11 phases)

Final roadmap reconciliation recognizes Phase 10A2/A3 as the operational acceptance of the private acquisition and zero-egress scanning path. Generic disabled worker classes and explicitly rejected/deferred providers remain post-v1 scope, so they do not reduce the approved roadmap completion percentage or imply that those capabilities are enabled.

## Branch cleanup

Cleanup was rechecked after the follow-up releases. The only open PR is Phase 12 operations PR #193. The merged PR #194 branch and merged Phase 12A foundation branch were proven reachable from `main` and deleted. Five additional fully merged, unattached local branches were removed. All remaining historical refs match the manifest's diverged or intentional preserve set, and the active Phase 12 refs were created after that audit. Dirty/diverged work was preserved. The final remote-tracking list contains 17 entries including the `origin/HEAD` alias.

## Durable boundaries

- ScopeForge Supabase is `tdgpibrepzcvdivztkta`; never use `xwsergbpvkcsugexssmc`.
- Dedicated worker: `cd9a7769-e21f-4f75-84c3-ffe2d1f4616e`.
- Accepted runtime image: `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`.
- Preserve authorization, target verification, one-request/5000-ms limits, zero-egress containment, mediator authority, cancellation, service-role-only control, and current RLS/security decisions.
- External Nmap, Nuclei, external httpx, broad exploit frameworks, and deferred advanced providers remain disabled unless separately reviewed.
