# PR #116 repository upload expiry acceptance

Reconciled: 2026-09-15, Asia/Singapore.

## Current checkpoint

PR #116 is merged to main as `a956e4b305a25d1e074e7b4bc2120a87b48d5050` (2026-09-15 09:23:44 UTC). Implementation commit: `73034b5dcc261bbe8447583ea51054dd1e6226df`. Final PR head `542d79cadb1be4f1793cadc8eeaf405a56fca3a2` passed all CI and Vercel gates before the exact-head-guarded merge. Post-merge CI and production verification also passed. This final record is documentation-only; fetch live refs because it advances main without changing the validated executable tree.

The checkout was clean before switching from the historical #110 branch. GitHub identity was verified as `LeDoNguyenTu`; origin is `LeDoNguyenTu/ScopeForge`. Fetched main `a8ea7803a8804449ab4fec493a860bac7eb3c562` was merged into #116 without rewriting history. Its changes were documentation-only.

## Genuine RED

The earlier runs `34943411866` and `34943713195` failed during module loading and are not RED evidence.

Both filesystem and HTTPS mocks now preserve the original module using `importOriginal` and override only the relevant operation in named and default export shapes. Preserving only the named export still invoked real `stat()` under module interop; that local `ENOENT` failure was also rejected as invalid evidence.

The regression advances the clock inside asynchronous `stat()`, avoiding assumptions about the number of clock reads. It covers exactly-at-expiry and after-expiry authorization.

- Test-only head: `6c0a769ef900863e82a8563651d4f03e379732cb`.
- [RED CI 34950725808](https://github.com/LeDoNguyenTu/ScopeForge/actions/runs/34950725808): 398 existing files / 1,759 existing tests passed; only the two expiry assertions failed.
- Expected: `Repository snapshot upload authorization is expired.`
- Received: `NETWORK_SHOULD_NOT_START`, thrown by the HTTPS request mock.
- Production uploader code was unchanged until this CI result was confirmed.

## Fix and coverage

The uploader retains its initial descriptor validation before filesystem access and validates again synchronously immediately before `httpsRequest()`. The PUT uses the URL from that final validation. Expired authority fails with the existing error before any request or file stream starts.

The allowed-path control streams a real seven-byte temporary fixture through a mocked successful HTTPS response while authority remains valid just before expiry. It checks payload bytes, PUT headers, conditional object creation, and disabled connection pooling. No real storage service is contacted by these tests.

## Validation

- Node `24.16.0` locally.
- Focused `npm test -- tests/repository-snapshots`: 23 files / 87 tests passed.
- `npm audit --audit-level=info`: zero vulnerabilities.
- `npm run typecheck`: passed.
- `npm run build:cli` and CLI `version`: passed (`ScopeForge 0.1.0`).
- `npm run benchmark:scanner`: passed, 700 files, no findings/errors, 7,549 ms wall time under the 20,000 ms ceiling.
- `npm run benchmark:matrix`: all three profiles and all nine measured runs passed their file/finding/error contracts and time ceilings.
- Initial unrestricted Windows full suite: three unrelated corpus/fixture timeouts, 1,735 tests passed, 24 platform capability skips. The bounded `npm test -- --maxWorkers=2` rerun passed 395 files / 1,738 tests, with four files / 24 platform capability skips. No test deadlines or security guards were changed.
- [GREEN candidate CI 34951258737](https://github.com/LeDoNguyenTu/ScopeForge/actions/runs/34951258737): SUCCESS on exact merge candidate `5658f5395f5e7f4075076519234d2a56c8caa806` for implementation head `73034b5dcc261bbe8447583ea51054dd1e6226df`. All 399 files / 1,762 tests passed with no skips. Audit, typecheck, CLI build/version, both benchmarks, optimized Next build, CSP/responsive browser acceptance, production UI/Turnstile diagnostic, and screenshot upload all passed. The production diagnostic's individual step succeeded; its non-blocking workflow setting was not treated as evidence of success.
- Browser artifact: `10389422455`, `v5-ui-acceptance-5658f5395f5e7f4075076519234d2a56c8caa806`. Preview dashboard/admin coverage uses fixtures; the public production diagnostic does not establish authenticated #79 canary acceptance.
- Actual artifact screenshots were inspected for the 390px GitHub preview, production landing, and production sign-in. The Turnstile widget is present; this does not prove a challenge was completed or an authenticated session was accepted.
- Vercel preview `dpl_GJ7meUuzwUyyyMQHiqitdfF6m3U8`: READY on that exact implementation head, verified against team `team_WEcf1g1YcD6vYU8LD5jVUOKF`, project `prj_r7X4rdsjvwzp2tvuSA4D39gpITb8`, Node 24.x.

## Final candidate and release evidence

- [Final-head CI 34951902373](https://github.com/LeDoNguyenTu/ScopeForge/actions/runs/34951902373): SUCCESS, exact merge candidate `b9943ea00ced4590e9a436f29206dad18418489a`, all 399 files / 1,762 tests and all audit/type/CLI/benchmark/build/browser/production-diagnostic gates passed. Artifact: `10389403515`.
- Final-head Vercel deployment `dpl_KUEFd18bcMWqTeAs6Ei5doEMsNnr`: READY on `542d79cadb1be4f1793cadc8eeaf405a56fca3a2` in the verified ScopeForge team/project.
- The actual merge tree is identical to the validated final PR head. Local main was fast-forwarded and verified at `0/0` relative to origin/main after merge.
- [Post-merge main CI 34952330303](https://github.com/LeDoNguyenTu/ScopeForge/actions/runs/34952330303): SUCCESS on `a956e4b305a25d1e074e7b4bc2120a87b48d5050`, all 399 files / 1,762 tests and every audit/type/CLI/benchmark/build/browser/production-diagnostic step passed. Artifact: `10388999994`.
- Production deployment `dpl_EjfAStxpz7kMv3i73if2iSdxURVm`: READY on merge `a956e4b305a25d1e074e7b4bc2120a87b48d5050`, aliased to `scopeforge.dev` in the verified ScopeForge team/project.
- Direct post-deployment HTTP checks: `/`, `/resources`, and `/auth/sign-in` returned 200; unauthenticated `/dashboard` redirected to `/auth/sign-in`. All checked responses retained nonce/strict-dynamic CSP, HSTS, frame denial, and `nosniff`.

## Phase 10 continuation

Issue #79 is still open. Its two real authenticated negative canaries remain required: an unrelated valid installation ID through the normal owner/admin signed flow, and Connect GitHub denial for a legitimate member/viewer. No new production membership or authenticated-canary evidence was obtained in this session.

Live draft heads at reconciliation:

- PR #76: `b09e03258329251361cf8d515458e0ff7d708e2c`.
- PR #77: `d9466f40e38e84e2fc694396c5947aa0f95a2d5d`, stacked on #76.

Release order remains #79 -> #76 -> #77. Later #76 reconciliation must inherit this shared-mainline fix and preserve #113/#114/#115 hardening. Its private claim migration changed after the historical preflight, so review the exact changed migration before any eventual apply.

`PHASE_10A2_WORKING_STATE.md` is present on the #76 branch, not main. Read it from the freshly fetched #76 ref with `git show origin/feat/phase-10a2-private-repository-acquisition:docs/development/PHASE_10A2_WORKING_STATE.md`.

No Phase 10 migrations, memberships, provider authorization, credentials, runtime gates, webhooks, or host configuration were changed. ScopeForge Supabase remains the designated target `tdgpibrepzcvdivztkta`; live schema/flag values were not re-read. Do not rerun completed Phase 6D Task 15 acceptance. Existing branch-cleanup counts are historical; preserve active refs and re-audit before deletion.
