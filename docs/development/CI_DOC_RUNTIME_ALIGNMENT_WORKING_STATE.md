# CI Documentation Runtime Alignment Working State

Last updated: 2026-09-13 (Asia/Singapore)

## Status

Released through PR #90.

- squash merge to `main`: `c3a42e2ff2d2dd3f2689e64847426fbd67a588b4`
- post-merge main CI #1030 / run `34745795461`: SUCCESS
- post-merge artifact: `10314341432`, 3,443,940 bytes

## Purpose

Align the public `docs/scanner/CI.md` workflow example with the released Node 24 runtime contract without changing scanner behavior, application behavior, migrations, provider settings, environment variables, or hosted runtime gates.

## TDD evidence

### RED

Regression guard commit:

`2d610a33960a33f927bfe17ee243242f3aba508e`

Validated PR head:

`1fd5bb96f7ab404c76cf42c623df6c04cd30bf74`

CI #1028 / run `34745362606`: expected FAILURE.

- Node `v24.20.0`, npm `11.19.0`
- audit: 0 vulnerabilities
- 395/396 test files passed
- 1,743/1,744 tests passed
- only `keeps the published CI integration example on Node 24` failed
- failure showed the guide still contained `node-version: 22`

### GREEN

Minimal implementation commit:

`dae39e9866d58861f2f6373c30ea878879c542cf`

Change:

- `docs/scanner/CI.md`: `node-version: 22` -> `node-version: 24`
- permanent architecture guard remains in `tests/architecture/node-runtime-alignment.test.ts`

CI #1029 / run `34745529387`: SUCCESS.

- Node 24 setup: PASS
- audit: 0 vulnerabilities
- tests: 396/396 files, 1,744/1,744 tests
- typecheck: PASS
- CommonJS CLI build/version: PASS
- scanner benchmark: PASS
- deterministic benchmark matrix: PASS
- optimized Next.js build: PASS
- strict-CSP browser acceptance: PASS
- production UI/Turnstile diagnostic: PASS
- visual artifact upload: PASS
- artifact: `10314316011`, 3,443,911 bytes

## Post-merge verification

Main CI #1030 / run `34745795461`: SUCCESS on exact merge SHA `c3a42e2ff2d2dd3f2689e64847426fbd67a588b4`.

- install and audit: PASS, 0 vulnerabilities
- tests: 396/396 files, 1,744/1,744 tests
- typecheck: PASS
- CommonJS CLI build/version: PASS
- scanner benchmark and deterministic matrix: PASS
- optimized Next.js build: PASS
- strict-CSP browser acceptance: PASS
- production UI/Turnstile diagnostic: PASS
- artifact upload: PASS
- artifact: `10314341432`, 3,443,940 bytes

At the time of this documentation update, Vercel had not yet surfaced a production deployment whose Git SHA is the PR #90 merge SHA. The currently served `scopeforge.dev` remained HTTP 200 with nonce CSP, HSTS, `nosniff`, frame denial, permissions policy, and referrer policy intact. Since PR #90 changes only documentation plus an architecture regression test, executable application behavior is unchanged.

## Release isolation

PR #90 did not alter:

- ScopeForge application or authorization behavior
- Supabase schema/data/migrations
- GitHub App secrets/settings
- Vercel environment variables
- hosted worker/runtime gates
- PR #76/#77 operational release gates
- issue #79 acceptance requirements

## Final checklist

- [x] failing regression guard observed before the documentation fix
- [x] minimal Node 24 documentation change applied
- [x] exact branch GREEN pipeline passed
- [x] final PR diff/review confirmed isolation
- [x] PR #90 squash-merged
- [x] post-merge `main` CI passed
