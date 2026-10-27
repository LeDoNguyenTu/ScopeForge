# Admin navigation session boundary

Candidate branch: `fix/admin-navigation-session-boundary-20261028`.
Baseline: `9324dd177bd75b060b197416f3025eb10d28c194`.

Issue #212 traces expected unauthenticated admin authorization errors to child Server Components starting before the parent layout redirect. `updateSession` now uses its existing validated user lookup to redirect unauthenticated GET/HEAD requests for `/admin` and `/admin/*` before rendering. Refreshed cookies, including their security options, are copied to the redirect. The root middleware attaches the same nonce CSP as before.

Signed-in requests continue to the existing server role/MFA checks. Non-GET/HEAD requests continue to their existing throwing mutation authorization boundary. No schema, worker, provider or capability state changes.

Local verification on 2026-10-28:

- Regression tests reproduced six failures before implementation.
- 92 focused auth/CSP tests passed after implementation.
- TypeScript check passed.
- Production build passed for 49 routes.
- GitNexus impact: low, one direct caller (`middleware`), zero indexed processes affected.
- Added five-route HTTP redirect/CSP smoke coverage to the existing Linux CI gate.

Starting a local preview server was rejected by automatic tool policy, so the local HTTP smoke check was not run. CI, deployment and the production telemetry verification window remain pending for this candidate. Issue #212 must remain open until production requests and logs demonstrate the required result.

The handoff reconciliation for #215 records merged work through PR #211 and fresh read-only Supabase evidence on connection `214nsa` for `tdgpibrepzcvdivztkta`. Phase 12 external providers remain default-off.

## Dependency gate correction

PR #216's first Linux CI run `40548129772` stopped at the unchanged `npm audit --audit-level=info` gate with six findings. The candidate updates Next.js from 15.5.24 to 15.5.28, Vitest to 4.1.12, Sharp to 0.35.5, Vite to 8.3.5 and source-map-js to 1.2.2. All stay within their existing major versions. The patch resolves the [Next.js image optimization advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [Server Actions advisory](https://github.com/advisories/GHSA-p3m5-59mp-jv5r), and findings reported for the other locked dependencies.

Fresh `npm audit --audit-level=info` reports zero vulnerabilities. On the patched dependencies, 104 focused security, auth, platform-admin and architecture test files passed: 510 tests passed and 3 skipped. TypeScript passed. Full Linux CI and the new production build remain required for the updated candidate.

## Released evidence

PR #216's final executable candidate `b0d50b6147fba39b80a5d468ff7442698413c316` passed full Linux CI `40548572541`. The owner explicitly authorized the administrative merge required by repository policy; the PR merged as `2a7eba25dcd6060dbfd1ad9e048f4ea4deb0d564`. Main CI `40551443353` passed. Vercel deployment `dpl_55gguyeyJShZDVQhvb7ToBYRDQ4F` is READY for that exact merge and serves `scopeforge.dev`.

Fresh production requests to `/admin`, `/admin/phase11`, `/admin/users`, `/admin/workspaces`, and `/admin/audit` all returned 307 to `/auth/sign-in` with nonce CSP and no authorization error in the response. Vercel runtime error queries for those routes from `2026-10-27T17:34:17Z` through the verification window returned no errors. A deployment-scoped query for `PLATFORM_ADMIN_UNAUTHENTICATED` also initially returned zero groups; a later repeat was aborted, while the grouped runtime-error query succeeded again with zero errors. Issue #212 is closed. This is evidence for the observed window, not a promise of permanent zero telemetry errors.
