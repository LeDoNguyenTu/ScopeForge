# ScopeForge Latest Session Reconciliation

Last reconciled: 2026-09-15 Asia/Singapore

Read this immediately after the root `AGENTS.md` when resuming work. This file records the latest live reconciliation and supersedes older status wording in the development handoff documents where they conflict. Always fetch live refs again before acting because documentation-only merges can advance `main` after this file is written.

## Current repository baseline

- Repository: `LeDoNguyenTu/ScopeForge`
- Current executable `main` before this documentation-only handoff: `8b27f343cc7c955c8cba59eb62ab664df893aa2b`
- Production domain: `https://scopeforge.dev`
- Vercel team/project: `itsbrian` / `scopeforge`
- ScopeForge Supabase project: `tdgpibrepzcvdivztkta`
- Never use the separate Job Command Center Supabase project for ScopeForge.

## Work completed in this session

### Dependency refresh already released

PR #109 was already merged when this session reconciled the repository. It advanced the dependency baseline and was not pending work.

### PR #111 - CI production WebDriver isolation

A hidden CI diagnostic defect was found while reviewing PR #110. The production browser diagnostic was marked non-blocking and attempted to reuse ChromeDriver port `9515` immediately after the preview CSP browser smoke. On the observed candidate the second driver could not bind because the previous process still owned the port, so the production diagnostic never actually executed even though the overall job stayed green.

The fix was implemented with TDD:

1. RED commit `9b6e1f98e5377b4d55c23e7a7cb5389b0613da7b` added a regression guard requiring an isolated production WebDriver endpoint.
2. `tests/browser/production-ui-smoke.mjs` now accepts `SCOPEFORGE_WEBDRIVER_BASE_URL` with the existing `9515` fallback.
3. The production diagnostic now launches ChromeDriver on `9516`, waits on `9516/status`, and supplies `SCOPEFORGE_WEBDRIVER_BASE_URL=http://127.0.0.1:9516`.
4. The preview CSP browser smoke remains on `9515`.

Exact PR #111 candidate validation, run `34889110293`, passed:

- Node 24
- npm audit with 0 vulnerabilities
- 398 test files / 1,749 tests
- typecheck
- CLI build/version
- scanner benchmark
- benchmark matrix
- optimized Next.js build
- CSP/responsive browser acceptance
- real production browser diagnostic on port `9516`
- production landing check
- Turnstile integration presence check
- screenshot artifact upload

PR #111 merged to `main` as `dda124cd029a13b66fc85e227be5bdea7b68b3b1`.

Its immediate post-merge CI was later cancelled by normal concurrency when PR #110 merged. That cancellation is superseded by the successful post-merge `main` run recorded below.

### PR #110 - GitHub connection reauthorization regression coverage

PR #110 adds test-only authorization regression coverage. No production runtime code, provider configuration, schema, hosted gate, credential, or migration changed.

The coverage now proves in tests that:

- both `member` and `viewer` roles are rejected before starting Connect GitHub
- an owner who loses permission after a signed connection start is rejected at both callback preparation and completion
- provider OAuth exchange, installation enumeration, and connection persistence are not reached after authorization failure
- same-user cross-workspace signed state is rejected
- denied Connect does not set a connection state cookie
- forbidden callbacks clear both secure callback cookies
- state, OAuth code, and private authorization details are not leaked in redirects or cookies

After PR #111 advanced `main`, PR #110 was reconciled without force-pushing by merging the new main tip into its branch. The resulting head was `55b38eb52669c9e3fb765b048cd3253d0f541c0c` and the exact GitHub merge candidate was `f182b078bfd8b02432b5b6a402b39e3c74d2501b`.

Fresh exact-candidate CI run `34889734417` passed:

- npm audit: 0 vulnerabilities
- 398 test files / 1,759 tests
- `tests/github-app/authorization.test.ts`: 14 tests
- `tests/github-app/routes.test.ts`: 11 tests
- typecheck
- CLI build/version
- scanner benchmark
- benchmark matrix
- optimized Next.js build
- CSP/responsive browser acceptance
- production diagnostic genuinely executed on ChromeDriver port `9516`
- production landing check passed
- Turnstile container/script integration check passed
- screenshot artifact upload passed, artifact `10366566405`
- Vercel preview status: success / Ready

PR #110 merged to `main` as `8b27f343cc7c955c8cba59eb62ab664df893aa2b`.

Post-merge main CI run `34890020818` then completed successfully with every validation step green, including audit, full tests, typecheck, CLI, both benchmarks, optimized build, CSP browser acceptance, production browser diagnostic, and artifact upload.

## Current hard blocker

Issue #79 remains OPEN and is still the release gate for Phase 10A2 and Phase 10A3.

The two remaining acceptance items must be genuine authenticated production browser canaries:

1. From an authenticated owner/admin callback flow, submit a different valid GitHub installation ID and prove rejection.
2. From an authenticated normal member/viewer session, prove Connect GitHub cannot be initiated or completed.

The new PR #110 tests strengthen the regression boundary but do not replace these live canaries.

Current live constraints remain:

- production has two known workspace memberships and both are owners
- there is no legitimate member/viewer identity available for the second canary
- the existing GitHub App connection redirects a new Connect GitHub attempt into installed-App settings, so a fresh unrelated installation-ID callback cannot currently be exercised through the normal signed flow

Do not weaken authorization, downgrade or fabricate an owner identity, forge production state, alter database membership solely to manufacture acceptance, expose provider credentials, or treat unit tests as the production canary.

## Phase 10 release order

Keep the release order strict:

1. Complete issue #79 with genuine live evidence.
2. Reconcile and validate draft PR #76, Phase 10A2 private repository acquisition.
3. Only after Phase 10A2 is safely released, reconcile and validate draft PR #77, Phase 10A3 webhook reconciliation.

Until #79 clears:

- keep PR #76 draft
- keep PR #77 draft
- do not apply the reviewed Phase 10A2 or Phase 10A3 migrations
- do not enable hosted repository snapshot, private snapshot, repository scan, passive runtime, or active CORS worker gates
- do not configure production webhook/runtime changes merely to unblock the queue

## Safe work while issue #79 is blocked

Continue only independent work that does not change the release state, such as:

- regression-test strengthening
- CI/runtime/tooling maintenance
- security or architecture review
- evidence-based UI fixes
- dependency maintenance
- documentation and handoff hygiene

Any new code change should use TDD where applicable and must receive fresh exact-candidate validation before merge.

## Immediate resume point

1. Fetch live `main`, open PRs, and issue #79 before changing anything.
2. Treat `8b27f343cc7c955c8cba59eb62ab664df893aa2b` only as the last executable baseline recorded here, not as an eternal current tip.
3. Do not reopen PR #110 or PR #111 work unless new evidence shows a regression.
4. If the two legitimate production identities/flows needed by #79 become available, complete only those two canaries first.
5. Otherwise continue safe independent maintenance without advancing #76/#77 production state.
