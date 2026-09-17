# Phase 10A3 Webhook Semantics Amendment

Status: accepted implementation clarification
Date: 2026-09-16

This amendment records two Phase 10A3 behaviors that now have stronger implementation/TDD evidence than the original 2026-09-12 design text. Where the original design conflicts with this file, this amendment is authoritative.

## 1. Provider-authoritative head recovery supersedes terminal stale-payload handling

The original design described a default-branch `push` whose signed `payload.after` differs from GitHub's freshly revalidated current head as `superseded` and terminal for that delivery.

Hardening #85 demonstrated that this could lose the newest provider head when the stale delivery was the only durable trigger available. The accepted behavior is now:

1. a valid signed delivery is a trigger, not repository truth
2. installation, repository, visibility, archive state, default branch, and current default-branch head are revalidated from GitHub
3. when `payload.after` is stale, the stale SHA is never recorded or enqueued
4. the freshly revalidated authoritative GitHub head proceeds through the existing `recordPushHead` semantic-replay/coalescing/runtime-gate path
5. exact `latest_delivery_id` stale checks remain authoritative downstream
6. public/private execution-class separation remains unchanged
7. no additional provider authority is granted to webhook payload fields

Regression evidence:

- RED head `1501b723f394938b8c2af501d50204bcd0db14f0`
- RED CI `34710448050`
- feature GREEN head `312495c5e4aef9e5a42d5e06d9e2f2471b0d2ced`
- feature GREEN CI `34710886639`
- integrated executable head `5f05ed964c8ab43f38a420b1b77317bae630cc1e`
- integrated CI `34711218370`
- permanent regression: `tests/github-app/webhook-superseded-head-recovery.test.ts`

Do not reintroduce an early `AUTHORITATIVE_HEAD_ADVANCED` terminal return solely because the signed payload SHA is behind provider truth.

## 2. Correctly signed unsupported events return HTTP 202

The original design's protocol contract remains authoritative here: a correctly signed but unsupported GitHub event is accepted at the transport boundary, ignored semantically, creates no delivery/reconciliation work, and returns HTTP 202.

PR #122 corrected the public route, which had been mapping every `ignored` service result to HTTP 200.

Accepted mapping:

- `ignored / EVENT_UNSUPPORTED` -> HTTP 202
- `queued` -> HTTP 202
- `pending` -> HTTP 202
- permanent supported-event ignore outcomes such as `REPOSITORY_ARCHIVED` -> HTTP 200
- replay and already-settled semantic outcomes remain their explicitly tested bounded 2xx responses

The distinction avoids claiming synchronous semantic completion for an event class ScopeForge intentionally does not process, while preserving 200 responses for permanent supported-event outcomes where GitHub retry pressure is not useful.

TDD evidence:

- RED head `162b6cbe61a1c0206162bdba896fdecae65dd701`
- RED CI `35108555834`: 414/415 files and 1,902/1,903 tests passed; sole failure expected 202 and received 200
- GREEN head `69fc6634f0ab57cadbf96526d9e3a84c6b181b4a`
- GREEN CI `35109054701`: full pipeline passed
- exact GREEN Vercel deployment `dpl_7H1Luv4gsbzjf5GMRBygWkyFvyJV`: READY
- merged into the Phase 10A3 branch only as `801ba7c7c76b3026f60ab7973315583a46e8d653`
- permanent regression: `tests/github-app/webhook-route.test.ts`

## Boundaries unchanged

This amendment does not authorize Phase 10A3 release. It changes no production migration, webhook registration, webhook secret, GitHub App permission, Phase 10A2 gate, or hosted worker runtime flag.

Phase 10A3 remains stacked behind Phase 10A2 PR #76 and must be reconciled/fresh-validated after #76 releases before any production Phase 10A3 migration or webhook configuration.
