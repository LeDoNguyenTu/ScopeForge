# Phase 10A1 GitHub Connected Projects Release State

Last reconciled: 2026-09-12 (Asia/Singapore)

## Scope

Phase 10A1 implements the public-repository connected-project core:

1. connect a workspace to a GitHub App installation,
2. prove the signed-in GitHub user can access that installation,
3. browse repositories through short-lived installation credentials,
4. import a repository as a verified ScopeForge repository asset,
5. start one project-level scan action,
6. publish an immutable source snapshot,
7. continue to the repository scanner without exposing snapshot/worker internals as the primary UX,
8. safely resume the exact already-published snapshot when continuation is delayed or retried.

Private repository acquisition remains a separate Phase 10A2 execution class. Phase 10A1 never routes private source through the public acquisition worker.

## Final release candidate

PR: #74
Branch: `feat/phase-10a-github-connected-projects`
Released base: `1151af2dddb76737ee2f0a0d1a802f06a975d318`

Pre-hardening current-main integration evidence was CI #949 / run `34656537969`, which validated Phase 10A1 head `17831b98dbbf06adf213cd2c8694ecd0d6852b74` as synthetic merge `c53b21f0b28735f3fc3fa59c85414f977346a403` into the released base.

The final release-gate behavior was validated by CI #954 / run `34678603273` on exact head `88fcf9312e6c83312dd5461e8d46dab97387d23b`, synthetic merge `73476056d1d04b08a9a43e90a77f4b0c4dbccdfc` into current `main`.

CI #954 passed:

- dependency installation,
- `npm audit --audit-level=info` with zero vulnerabilities,
- 387 / 387 test files,
- 1,726 / 1,726 tests,
- TypeScript typecheck,
- CLI build/version (`ScopeForge 0.1.0`),
- scanner benchmark (`scanner-medium-v1`, 700 files, 778 ms wall time against 20 s maximum),
- dependency-lockfile / IaC / source-AST benchmark matrix within all budgets,
- optimized Next.js 15.5.24 production build,
- strict-CSP browser smoke,
- production `scopeforge.dev` V5/Turnstile diagnostic,
- four-file visual acceptance artifact upload, artifact `10293955396`.

## Production Supabase state - verified

ScopeForge production project: `tdgpibrepzcvdivztkta`.

Production records all five Phase 10A1 forward migrations:

- `20260910160000_phase_10a1_github_connected_projects`
- `20260910160010_phase_10a1_project_scan_retry_idempotency`
- `20260910160020_phase_10a1_project_scan_waiting_idempotency`
- `20260910160030_phase_10a1_project_scan_recovery`
- `20260911143049_phase_10a1_service_role_table_acl_hardening`

Live table privileges after hardening are:

- `authenticated`: `SELECT` only on `public.github_connections` and `public.github_repository_links`,
- `service_role`: `SELECT`, `INSERT`, `UPDATE`, `DELETE` only on those two tables,
- no retained `TRUNCATE`, `REFERENCES`, or `TRIGGER` table privilege for `service_role`.

Targeted production verification also confirmed:

- both public GitHub tables have RLS enabled,
- browser mutation authority is absent,
- `private.github_project_scan_intents` has RLS enabled and no browser/service-role direct table grant,
- Phase 10A1 privileged public RPCs remain `SECURITY DEFINER`, use pinned empty search paths, and grant execution only to `service_role`.

Fresh production preflight on 2026-09-12 still shows no Phase 10A2/10A3 migration applied early and zero rows in both `github_connections` and `github_repository_links`.

Security Advisor has no Phase 10A1 release-blocking schema finding. The private intent no-policy INFO is intentional. Leaked-password protection is a separate account-plan/Auth follow-up.

## Security and correctness properties

- GitHub App configuration is server-only; no provider secret uses a `NEXT_PUBLIC_` variable.
- Connection state is signed, time-bounded, and bound to the exact ScopeForge user/workspace.
- GitHub setup `installation_id` is not treated as proof of ownership.
- Temporary GitHub user OAuth tokens and installation tokens are not persisted.
- Installation tokens are short-lived, read-only, and repository-scoped when operating on one repository.
- Repository import accepts only a numeric repository ID from the browser and re-fetches authoritative metadata through GitHub.
- Integration mutations are owner/admin-only and server-side.
- Browser-visible connection/link tables are read-only through workspace-scoped RLS; worker intent remains private.
- Public and private repository execution classes remain separated.
- Hosted repository snapshot and scan runtime gates remain independently fail-closed.
- Exact-snapshot recovery cannot silently select a newer repository snapshot.

## Release-gate hardening

A direct Vercel preview probe on 2026-09-12 exposed a release-sequencing deadlock:

- the Phase 10A1 preview route existed, but unauthenticated connect errors fell back to `http://localhost:3000` when Preview did not define `NEXT_PUBLIC_SITE_URL`,
- the GitHub App setup/callback URL is intentionally fixed to production `scopeforge.dev`, so the real provider installation proof cannot complete on Preview,
- without an additional release gate, merging Phase 10A1 would immediately expose the live Connect GitHub and Import from GitHub entry points before the production provider canary could be completed.

The release-hardening design therefore introduces a separate default-off server capability:

`HOSTED_GITHUB_INTEGRATION_ENABLED`

It enables only on exact string value `true`. Missing, `false`, whitespace variants, uppercase variants, and all other values stay disabled.

The gate applies to:

- `/api/integrations/github/connect` before any provider call,
- `/api/integrations/github/callback` before OAuth/provider work, with transient cookies cleared,
- the GitHub integration dashboard,
- the Add Asset GitHub import entry point,
- the repository-import server action.

The connect route also falls back to the request origin when no canonical site URL is configured, eliminating the Preview-to-localhost redirect defect.

### RED evidence

CI #953 / run `34678149019` validated exact RED head `207d5c443027e9301e10cf4f8410c5b91304aa1c` as synthetic merge `15696d0ddc96e3b31ce03c61690c3dae56ee9839` into current `main`.

The result was intentionally RED:

- dependency install: PASS,
- audit: PASS, 0 vulnerabilities,
- 385 / 387 test files passed,
- all 1,719 pre-existing tests passed,
- exactly 6 new release-hardening tests failed,
- failures were limited to: connect fail-closed, request-origin redirect, callback fail-closed, Add Asset gate, integration-page gate, and repository-import action gate.

No unrelated regression appeared.

### GREEN evidence

CI #954 / run `34678603273` validated the implemented release gate on exact head `88fcf9312e6c83312dd5461e8d46dab97387d23b` as synthetic merge `73476056d1d04b08a9a43e90a77f4b0c4dbccdfc` into current `main`.

All six release-hardening assertions turned GREEN while the complete suite and release matrix passed. No unresolved PR review threads remain.

## GitHub App provider acceptance

Provider requirements remain documented in `PHASE_10A1_GITHUB_APP_SETUP.md`:

- homepage `https://scopeforge.dev`,
- setup/callback `https://scopeforge.dev/api/integrations/github/callback`,
- installation-time OAuth disabled,
- Contents read-only,
- Metadata read-only,
- no repository write permission.

The connected Vercel management surface in this session does not expose project environment-variable metadata or an environment mutation API, so the presence/enablement of production GitHub settings cannot be asserted or changed from this chat without guessing.

Production database state still has zero connection/link rows, so the owner/admin provider acceptance has not occurred yet. This no longer blocks the dark code release because the new server gate prevents exposure/provider work until deliberately enabled.

## Safe release sequence

Phase 10A1 can now release without exposing an unverified integration. The intended sequence is:

1. merge/deploy Phase 10A1 with `HOSTED_GITHUB_INTEGRATION_ENABLED` missing or `false`,
2. verify the merged production deployment and confirm the connect edge returns the disabled path before provider work,
3. verify the six server-only GitHub App values through a supported configuration surface without exposing values,
4. verify provider URLs and read-only permissions,
5. set `HOSTED_GITHUB_INTEGRATION_ENABLED=true` deliberately for a controlled owner/admin production canary,
6. perform Connect GitHub -> installation proof -> repository listing -> repository import,
7. verify no provider token/private key/signed state leaks to browser state, persisted integration rows, redirects or ordinary logs,
8. keep the integration enabled only if acceptance remains green; otherwise disable immediately,
9. keep repository snapshot/scan/runtime worker flags disabled until their own independent acceptance.

## Hosted runtime flags

Do not enable these as part of Phase 10A1 provider rollout alone:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED`

Their independent containment/canary/rollback acceptance remains mandatory.

## Phase 10A2 / Phase 10A3 stack

PR #76 implements the distinct private-repository acquisition path and remains draft/stacked on Phase 10A1. Its current validated head is `e812a236f3782059e72a5fd2793d4f9b2641e81f` and CI #913 is green against the previous Phase 10A1 head.

PR #77 implements authenticated webhook reconciliation on Phase 10A2. Its current validated head is `16ac1824b127da32b3ae995e9d5fb4c273993c02`; CI #951 / run `34658665105` is green with 402 files / 1,839 tests and the full release matrix.

Both downstream branches must be reconciled onto the final released Phase 10A1 head after #74 merges. Their existing evidence remains useful but does not replace fresh post-reconciliation validation.