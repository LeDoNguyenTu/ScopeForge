# Phase 10A1 GitHub Connected Projects Working State

Last reconciled: 2026-09-12 (Asia/Singapore)
Branch: `feat/phase-10a-github-connected-projects`
PR: #74
Status: release-gate GREEN candidate pending exact-head CI; provider activation remains post-merge and default-off

## Implemented

- Shared strict boolean runtime-capability parser for hosted repository snapshot and repository scan gates.
- Server-only GitHub App configuration with no public-secret fallback.
- Ten-minute signed user/workspace connection state and constant-time signature verification.
- RS256 GitHub App JWT signing using Node crypto.
- Bounded GitHub provider client for OAuth exchange, user installation proof, installation tokens, repository listing and repository-ID lookup.
- Installation tokens request only `contents: read` and `metadata: read`; single-repository operations are repository-scoped.
- Provider response/error normalization prevents raw provider bodies or tokens from reaching browser responses.
- `github_connections` and `github_repository_links` schema with same-workspace composite foreign keys and read-only browser RLS.
- Owner/admin-only connection flow that does not trust GitHub setup `installation_id` by itself.
- Temporary GitHub user OAuth tokens are discarded after installation verification.
- Owner/admin-only repository discovery and import.
- Browser sends only numeric repository ID; authoritative metadata is re-fetched with a repository-scoped installation token.
- GitHub-confirmed repositories are registered/reused as verified ScopeForge repository assets with idempotent links.
- Private repositories may be linked but remain outside the Phase 10A1 public acquisition execution class.
- Connected-project dashboard UX presents one project-level scan action while retaining existing manual repository tools.
- Public connected-project scan orchestration persists private worker intent, queues immutable source acquisition, and automatically continues after successful snapshot publication.
- Project-level read model exposes only bounded safe state.
- Exact-snapshot recovery supports `waiting_scan_runtime`, `retry_pending`, and idempotent `scan_queued` replay without implicit source reacquisition.

## Production database verification completed

Correct ScopeForge Supabase project: `tdgpibrepzcvdivztkta`.

Production currently records five Phase 10A1 migrations:

- `20260910160000_phase_10a1_github_connected_projects`
- `20260910160010_phase_10a1_project_scan_retry_idempotency`
- `20260910160020_phase_10a1_project_scan_waiting_idempotency`
- `20260910160030_phase_10a1_project_scan_recovery`
- `20260911143049_phase_10a1_service_role_table_acl_hardening`

The final forward migration was added after live review found trusted `service_role` inherited table privileges beyond application need. It now has only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on the two public GitHub integration tables. Authenticated browser users retain `SELECT` only.

Live checks confirm RLS/browser-write boundaries, private intent-table isolation, pinned `SECURITY DEFINER` search paths, and service-role-only privileged RPC execution.

Security Advisor has no Phase 10A1 release-blocking schema finding. The private intent table's no-policy INFO is intentional for the private service-only boundary. Leaked-password protection remains a separate account-plan/Auth follow-up.

## TDD / validation history

- Recovery RED checkpoint `b776ab78b61b490be04a8121bb07958d36ed19f2`: 1,711 existing tests passed and exactly eight new recovery assertions failed.
- Recovery GREEN candidate `005504387cf29d65d6b297acb041b608f0416c1a`: CI #852 / run `34520609482` SUCCESS.
- ACL-hardening RED checkpoint `e5ffd6a8e640483adec01d1856878f78f4114c83`: all 1,719 existing tests passed and exactly the new migration-presence assertion failed.
- ACL-hardening GREEN candidate `a8959d4b887463b0b28af056932eabd2a75147a3`: CI #907 / run `34610625305` SUCCESS.
- Fresh current-main synthetic validation CI #949 / run `34656537969`: SUCCESS on Phase 10A1 head `17831b98dbbf06adf213cd2c8694ecd0d6852b74` merged into released `main` `1151af2dddb76737ee2f0a0d1a802f06a975d318`.

Fresh CI #949 passed dependency audit with zero reported vulnerabilities, 387 test files / 1,720 tests, typecheck, CLI build/version, both benchmark layers, production build, CSP smoke, production V5/Turnstile diagnostic and visual artifact upload.

## Release-gate hardening RED evidence

A provider-side Preview probe exposed two related release issues:

1. unauthenticated `/api/integrations/github/connect` errors fell back to `http://localhost:3000/...` when Preview did not define `NEXT_PUBLIC_SITE_URL`, and
2. GitHub connected-project entry points would become visible immediately after merge even though the real GitHub App installation/callback is intentionally production-bound to `scopeforge.dev` and cannot be truthfully accepted on Preview.

The complete RED contract therefore required:

- a default-off server capability `HOSTED_GITHUB_INTEGRATION_ENABLED`,
- connect and callback routes to fail closed before provider/OAuth work while disabled,
- the integration dashboard to hide the live Connect action while disabled,
- the Add Asset page to hide Import from GitHub while disabled,
- the repository-import server action to reject while disabled,
- connect-route local errors to fall back to the actual request origin instead of localhost.

CI #953 / run `34678149019` proved the RED contract on head `207d5c443027e9301e10cf4f8410c5b91304aa1c`, synthetic merge `15696d0ddc96e3b31ce03c61690c3dae56ee9839`:

- install: PASS,
- audit: PASS, 0 vulnerabilities,
- 385 / 387 test files passed,
- all 1,719 pre-existing tests passed,
- exactly 6 new release-hardening assertions failed,
- failures were limited to the intended connect gate, request-origin redirect, callback gate, Add Asset gate, integration-page gate, and repository-import action gate.

No unrelated regression appeared.

## Release-gate GREEN candidate

The missing behavior is now implemented as a narrow release-hardening layer:

- `HOSTED_GITHUB_INTEGRATION_ENABLED` is part of the existing exact-`true` server capability parser and defaults disabled,
- `/api/integrations/github/connect` refuses provider work while disabled and uses request origin as the no-canonical-site fallback,
- `/api/integrations/github/callback` refuses OAuth/provider work while disabled and clears transient GitHub cookies through the terminal redirect path,
- the GitHub integration dashboard presents a truthful disabled state with no Connect action,
- the Add Asset page omits the GitHub import panel while disabled,
- the repository-import server action fails closed with bounded `GITHUB_INTEGRATION_DISABLED`,
- `.env.example`, `docs/ENVIRONMENT.md`, provider setup and release-state documentation now define the dark-gated rollout.

This is a GREEN **candidate only** until the exact docs-inclusive head completes the full CI matrix. No success claim should be inferred before that run finishes.

## Safe release model

Once the exact-head GREEN candidate is fully validated, Phase 10A1 can merge/deploy with `HOSTED_GITHUB_INTEGRATION_ENABLED` missing or false. That leaves all GitHub connected-project entry points dark while preserving the production provider-acceptance standard.

After dark deployment:

1. verify the six server-only GitHub App settings through a supported provider/configuration surface without exposing values,
2. verify provider URLs and read-only permissions,
3. deliberately set `HOSTED_GITHUB_INTEGRATION_ENABLED=true` for the controlled owner/admin production canary,
4. perform Connect GitHub -> installation proof -> repository listing -> repository import,
5. inspect browser/persistence/log surfaces for credential/token/state leakage,
6. keep the gate enabled only if acceptance remains green; otherwise disable immediately.

The hosted repository snapshot/scan/runtime worker gates remain separate and must stay disabled until their own independent acceptance.

## Released baseline

Current released `main`: `1151af2dddb76737ee2f0a0d1a802f06a975d318`.
Current production domain: `scopeforge.dev`.
The Phase 10C admin/V5/CSP baseline remains authoritative until PR #74 is merged and the resulting production deployment is verified.

## Remaining release work

1. Complete the full exact-head GREEN CI for this docs-inclusive candidate.
2. Perform a final changed-file/security review against the RED contract.
3. Merge PR #74 only if the final head is green and the new integration gate remains default-off.
4. Verify the merged production deployment and confirm the connect edge is dark-gated before any provider activation.
5. Reconcile draft PR #76 onto the released Phase 10A1 baseline and rerun the complete Phase 10A2 matrix.
6. Continue Phase 10A2/10A3 operational canaries in release order without enabling worker runtimes prematurely.

Detailed release evidence: `docs/development/PHASE_10A1_RELEASE_STATE.md`.