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
