# Phase 10A3 GitHub Webhook Reconciliation Design

Status: approved in chat on 2026-09-12
Date: 2026-09-12
Stacked baseline: Phase 10A2 reconciliation head `e812a236f3782059e72a5fd2793d4f9b2641e81f`
Target integration order: Phase 10A1 -> Phase 10A2 -> Phase 10A3

## Goal

Phase 10A3 turns connected GitHub projects from a manual scan workflow into a continuously reconciled workflow driven by authenticated GitHub App webhooks.

Target flow:

```text
Connect GitHub
  -> select repository
  -> verified ScopeForge project
  -> default-branch push
  -> authenticated webhook
  -> authoritative repository/head revalidation
  -> coalesced automatic scan intent
  -> existing public or private snapshot class
  -> immutable snapshot
  -> existing zero-egress repository scan
  -> findings refresh
```

Manual `Scan project` remains available. Phase 10A3 does not widen Phase 10A1 or Phase 10A2 credentials, worker network authority, repository permissions, or runtime gates.

## Core decisions

1. GitHub App webhooks are the normal event source. Polling is not the primary mechanism.
2. Phase 10A3 scans only the current authoritative default-branch head.
3. Rapid pushes coalesce through a per-link desired-head watermark so the newest commit is never lost while an older scan is active.
4. Automatic scans are system-triggered. No browser session is invented and no user is treated as having manually requested the scan.
5. Public and private source acquisition remain separate execution classes.
6. Phase 10A3 adds no GitHub write permission, pull-request annotation, check run, issue/comment mutation, or repository code execution.

## Webhook endpoint

Add one public server endpoint:

```text
POST /api/integrations/github/webhook
```

The route is unauthenticated at the browser/session layer because GitHub is the caller. Trust comes from HMAC verification over the raw request bytes and subsequent database/provider revalidation.

The route returns bounded responses and never echoes the raw payload, signature, provider body, token, temporary archive URL, or secret material.

## Server-only configuration

Add:

```text
GITHUB_APP_WEBHOOK_SECRET
```

Requirements:

- separate from `GITHUB_APP_CLIENT_SECRET`
- separate from `GITHUB_APP_STATE_SECRET`
- 32 to 512 characters
- server-only, never `NEXT_PUBLIC_*`
- included in validated `GitHubAppConfig` as `webhookSecret`
- never logged, persisted, returned to the browser, passed to workers, or included in audit metadata

## Raw request validation

Hard raw-body ceiling: 10 MiB.

Before event processing:

- require JSON-compatible content type
- require `x-hub-signature-256` in `sha256=<64 hex>` form
- require `x-github-delivery` to be a UUID
- require `x-github-event` to be a bounded ASCII token of at most 64 characters
- reject `Content-Length` above 10 MiB before reading the full body when present
- independently enforce the same 10 MiB ceiling while reading the request body

Responses:

- oversized body: `413`
- malformed headers/body: `400`
- invalid signature: `401`

None of these failure paths persist a delivery or call GitHub APIs.

## Signature verification

Use HMAC-SHA256 over the exact untouched raw bytes and `GITHUB_APP_WEBHOOK_SECRET`.

Implementation requirements:

- compute expected digest from raw bytes
- decode expected and supplied digests to equal-length byte arrays
- compare with `crypto.timingSafeEqual`
- never use ordinary string equality for digest comparison
- never parse or normalize JSON before signature verification
- never log supplied/computed signatures

## Event allowlist

Phase 10A3 handles:

```text
ping
push
installation
installation_repositories
repository
```

A correctly signed unknown event returns `202` ignored and creates no delivery row.

### `ping`

A valid signed ping returns `200`. It creates no scan and persists no payload.

### `push`

Only the authoritative current default-branch head is eligible. Ignore tags, non-default branches, branch deletion/zero SHA, and superseded commits.

### `installation`

Handle:

- `suspend`
- `unsuspend`
- `deleted`

`created` never creates a ScopeForge workspace connection. Workspace binding remains the owner/admin install/OAuth flow from Phase 10A1.

### `installation_repositories`

Removed repository IDs make existing matching links inaccessible. Added repository IDs may reactivate an existing matching link only after provider revalidation. They never create new ScopeForge assets or links.

### `repository`

Handle only lifecycle actions that affect an existing connected link:

- renamed
- transferred
- privatized
- publicized
- archived
- unarchived
- deleted

Stable GitHub numeric repository ID is the lookup key.

## Persisted webhook delivery model

Add private service-only table:

```text
private.github_webhook_deliveries
```

Persist only:

- delivery UUID, unique
- event name
- bounded action
- installation ID when present
- repository ID when present
- push `after` SHA when relevant
- processing/result state
- bounded error/result code
- received timestamp
- processed timestamp

Never persist:

- raw webhook JSON
- signature header
- webhook secret
- App JWT
- installation/user OAuth token
- authorization headers
- sender/user profile payload
- commit messages
- author details
- temporary private archive URL
- source code

RLS is enabled. Browser roles receive no policy and no direct grant. New privileged RPCs are service-role-only.

## Per-link automatic scan state

Add private service-only state keyed one-to-one by connected repository link. Suggested table:

```text
private.github_repository_auto_scan_state
```

Persist only bounded synchronization metadata:

- workspace ID
- link ID
- repository ID
- latest observed authoritative default-branch SHA
- latest successfully scanned snapshot SHA
- latest accepted delivery UUID
- `pending` boolean
- bounded last outcome/error code
- timestamps

This table is the coalescing boundary.

It must not contain raw payloads, provider tokens, signatures, source URLs, archive capabilities, or source bytes.

## Delivery and semantic idempotency

Three cases are distinct:

1. Delivery replay - same `x-github-delivery`. No side effect repeats.
2. Semantic replay - new delivery ID for repository SHA already accepted/scanned. No duplicate scan chain.
3. Stale delivery - event SHA is no longer the authoritative default-branch head. Record/return superseded and do not scan it.

The delivery UUID is the replay key. Repository ID plus authoritative SHA is the semantic dedupe key.

## Push trust model

Webhook repository metadata is a hint only.

Read only bounded candidate fields from the signed payload:

- installation ID
- repository ID
- `ref`
- `after`
- deletion/zero-SHA condition

Do not trust payload visibility, URL, owner/name, default branch, or permissions.

Processing sequence:

1. Verify HMAC over raw bytes.
2. Validate headers and bounded JSON shape.
3. Atomically admit the delivery UUID.
4. Load matching stored GitHub connection/link by stable repository ID and installation mapping.
5. Require active connection, active link, and `auto_scan_enabled = true`.
6. Mint repository-restricted read-only installation credentials through the existing control plane.
7. Re-fetch the exact repository and verify ID, canonical URL, current visibility, installation access, and default branch.
8. Fetch the authoritative current default-branch head SHA.
9. Require event `ref` to equal `refs/heads/<authoritative-default-branch>`.
10. Require event `after` to be a 40-character hex SHA and equal the authoritative current head.
11. If not equal, record `superseded` and stop.
12. Reconcile safe link/asset metadata only after identity verification.
13. Atomically update the per-link desired-head watermark to the authoritative SHA.
14. If no compatible automatic scan is active and the desired SHA is not already the latest successfully scanned SHA, enqueue one automatic scan chain.
15. If a scan is already active, set `pending = true` and do not create a second active chain.
16. Apply the existing public/private source runtime gates and repository scan gate. No webhook bypass exists.
17. Persist only bounded delivery outcome metadata.

## Rapid push coalescing and no-lost-head guarantee

Example:

- push A arrives and starts scan A
- push B arrives while A is active
- push C arrives while A is active

B and C do not create concurrent snapshot tasks. Each valid event advances the desired-head watermark. The final desired SHA becomes C.

When scan A reaches terminal publication/continuation state, the automatic reconciliation hook compares:

```text
latest successfully scanned snapshot SHA
vs
latest observed desired-head SHA
```

If they differ and the link/connection/runtime remains eligible, ScopeForge enqueues exactly one follow-up chain for the then-current authoritative default-branch head.

If the provider head advanced again to D before that enqueue, fresh provider revalidation updates the watermark to D and D becomes the next target. Intermediate B/C scans may be skipped, but the newest head is never silently lost.

This provides latest-state continuous scanning without an unbounded queue per push.

## Automatic scan authorization and attribution

A webhook delivery has no human session. Automatic scans are authorized by trusted system state, not by pretending a user clicked the button.

Add a dedicated service-role-only automatic project-scan enqueue path. It must:

- require a verified active GitHub connection and repository link
- require `auto_scan_enabled = true`
- require the repository/installation/workspace relationship to match
- require the requested automatic target to equal the current trusted desired-head watermark
- preserve existing workspace quotas, cooldown/backpressure rules, task limits, and runtime gates
- create the same worker execution classes and immutable snapshot pipeline used by manual scans
- record trigger origin as `github_webhook`

For backward-compatible audit/FK fields that still require a user reference, `github_connections.installed_by` may be retained only as historical attribution. It is not fresh authorization and the automatic enqueue RPC must not require that user to have an active browser session.

The preferred schema adds explicit trigger provenance to the connected-project intent, such as:

```text
trigger_kind = manual | github_webhook
trigger_delivery_id = nullable UUID
trigger_commit_sha = nullable 40-char hex
```

Manual flows keep their current owner/admin authorization. Automatic flows are service-role-only and derive authority from the active connection/link/auto-scan state.

## Scan completion reconciliation

The existing snapshot/scan finalization path gains a narrowly scoped automatic reconciliation hook after a connected-project scan reaches a safe terminal point.

For webhook-triggered project scans:

1. read the published immutable snapshot SHA
2. update `latest successfully scanned snapshot SHA`
3. re-read the desired-head watermark under lock
4. if equal, clear `pending`
5. if different, leave/set `pending` and schedule one follow-up automatic scan when runtime/backpressure allows

This hook must be idempotent under replayed worker finalization.

A failed scan does not advance `latest successfully scanned snapshot SHA`. Retry/recovery continues through the existing project-scan mechanisms. The auto-scan state keeps the desired SHA pending until a successful later scan or an explicit ineligible state.

## Default branch and repository identity changes

Fresh GitHub provider metadata is authoritative.

For rename/transfer:

- lookup by stable repository ID
- re-fetch through stored installation
- atomically update link owner/name/full name/default branch/visibility/canonical URL and repository asset canonical target only after provider verification

A push to an old default branch is ignored after GitHub reports a new default branch.

Deleted or inaccessible repositories are marked removed/inaccessible. Historical assets, snapshots, findings, and audit history remain.

Archived repositories are not automatically scanned. Archive state may remain provider-derived without a new public field unless implementation requires a bounded persisted state.

## Visibility transitions

Phase 10A3 preserves execution-class isolation.

If authoritative visibility changes:

- update trusted link metadata only after provider verification
- never reuse a queued public acquisition as private or vice versa
- the next automatic scan chooses its class from fresh provider visibility
- public acquisition never receives private authority
- private acquisition still requires `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`

## Installation reconciliation

### Suspend

- set connection `suspended`
- mark links inaccessible
- prevent new automatic scans
- retain historical results
- queued provider acquisition that has not completed fresh claim-time authorization fails closed

### Deleted

- set connection `removed`
- mark links removed
- disable automatic scanning
- retain historical data

### Unsuspend

Do not reactivate from event payload alone.

- re-fetch installation/provider access
- reactivate connection only after verification
- individually reactivate existing links only when repository identity/access still matches
- no new asset/link is created

### Installation repository selection

- removed IDs immediately make matching links inaccessible
- added IDs can reactivate only an existing link after provider revalidation
- no automatic import

## Runtime gates

Webhook acceptance/reconciliation and worker execution remain separate.

Existing gates stay authoritative:

```text
HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED
HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED
HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED
```

If the required source runtime is disabled, no source worker task is created. The desired-head watermark stays pending with bounded `runtime_unavailable` state so a later explicit recovery/reconciliation path can continue after runtime authorization.

Phase 10A3 does not enable any hosted runtime flag.

## Provider client boundary

Extend the existing server-only GitHub provider client with narrow typed methods only:

- exact installation repository lookup
- authoritative default-branch head lookup
- installation metadata lookup for suspend/selection reconciliation

No generic arbitrary GitHub URL client is introduced.

Provider errors are normalized. Raw provider bodies and credentials never escape the control-plane client.

## Error model

Representative bounded codes:

```text
GITHUB_WEBHOOK_SIGNATURE_INVALID
GITHUB_WEBHOOK_HEADERS_INVALID
GITHUB_WEBHOOK_PAYLOAD_INVALID
GITHUB_WEBHOOK_PAYLOAD_TOO_LARGE
GITHUB_WEBHOOK_REPLAYED
GITHUB_WEBHOOK_EVENT_IGNORED
GITHUB_WEBHOOK_PUSH_NON_DEFAULT_BRANCH
GITHUB_WEBHOOK_PUSH_SUPERSEDED
GITHUB_WEBHOOK_REPOSITORY_NOT_CONNECTED
GITHUB_WEBHOOK_REPOSITORY_ACCESS_INACTIVE
GITHUB_WEBHOOK_REPOSITORY_IDENTITY_CHANGED
GITHUB_WEBHOOK_PROVIDER_FAILED
GITHUB_WEBHOOK_RUNTIME_UNAVAILABLE
GITHUB_WEBHOOK_RECONCILE_FAILED
```

Correctly signed transient internal/provider failures may return retryable `5xx`. Permanent ignored/ineligible states return `2xx` to avoid useless GitHub retry storms.

No raw payload, provider body, signature, token, secret, authorization header, or private archive URL appears in errors.

## Database and RPC security

All Phase 10A3 schema is forward-only and stacked after Phase 10A2.

Every new `SECURITY DEFINER` function:

- uses `set search_path = ''`
- fully qualifies objects
- validates IDs and workspace/link/installation relationships
- uses advisory/row locking for delivery admission and per-link coalescing
- revokes execution from `PUBLIC`, `anon`, and `authenticated`
- grants only minimum `service_role` execution

Browser roles receive no direct mutation or read access to raw webhook synchronization tables.

No Phase 10A3 table may contain raw payloads, secrets, signatures, provider tokens, authorization headers, temporary archive capabilities, or source bytes.

## Logging and privacy

Allowed log fields:

- delivery UUID
- event/action
- installation ID
- repository ID
- ScopeForge link/task IDs
- bounded result/error code
- duration

Forbidden log fields:

- request body
- commit messages
- sender/author payload data
- signature
- webhook secret
- provider credential
- raw provider body
- private archive URL

## UI

No new dashboard architecture is required.

Existing connected-project UI may show:

- automatic scanning on/off
- latest bounded automatic scan state
- inactive/suspended provider state
- manual `Scan project` action

No webhook payload is browser-readable.

`auto_scan_enabled` must be honored immediately. An owner/admin toggle is a bounded follow-up if the current UI does not expose it yet.

## TDD requirements

Implementation must preserve RED then GREEN evidence for security-sensitive behavior.

Required tests:

1. separate `GITHUB_APP_WEBHOOK_SECRET` validation
2. valid HMAC over exact raw bytes
3. altered body fails old signature
4. missing/malformed signature fails before persistence/provider calls
5. constant-time comparison path
6. content-length and streamed 10 MiB ceiling
7. invalid delivery UUID/event header rejection
8. same delivery UUID has no repeated side effects
9. unsupported signed event ignored without persistence
10. signed ping succeeds without scan
11. tags/non-default branch ignored
12. deletion/zero SHA ignored
13. stale push superseded after head re-fetch
14. current authoritative default-branch push accepted
15. payload URL/visibility/default branch cannot override provider state
16. disconnected or auto-scan-disabled link creates no scan
17. suspended/removed connection/link creates no scan
18. semantic duplicate repository/SHA creates no duplicate chain
19. push while scan active advances desired watermark and sets pending
20. multiple rapid pushes coalesce to newest watermark
21. terminal scan reconciliation clears pending when scanned SHA equals desired SHA
22. terminal scan reconciliation schedules one follow-up when desired SHA advanced
23. replayed finalization cannot duplicate the follow-up
24. failed scan does not advance latest-successful SHA
25. automatic enqueue requires no browser session
26. automatic enqueue authority derives from active connection/link/auto-scan state
27. installed-by user is attribution only, not fresh manual authorization
28. public repository routes only to public snapshot class
29. private repository routes only to private snapshot class
30. visibility transition cannot reuse wrong class
31. runtime gates stay fail-closed
32. installation suspend/delete lifecycle behavior
33. unsuspend requires provider revalidation
34. repository selection removal/inclusion reconciliation
35. webhook events cannot create new assets/links
36. rename/transfer updates link and asset identity atomically
37. repository deletion preserves history
38. event/auto-scan tables contain no raw payload/secret/token/archive URL columns
39. new privileged RPCs remain service-role-only with pinned search path
40. logs/results exclude secret-bearing fields
41. existing manual public/private project scan tests remain green
42. Phase 10C admin, strict CSP, V5/dashboard, worker authorization, runtime, snapshot, repository-scan, and scanner regression suites remain green

## Release gates

Phase 10A3 cannot release ahead of Phase 10A1 or Phase 10A2.

Before release:

1. Phase 10A1 live GitHub provider canary passes and Phase 10A1 releases.
2. Phase 10A2 satisfies its schema/provider/private-runtime canary and releases before private automatic scanning is authorized.
3. Phase 10A3 is reconciled onto the released predecessor and fully revalidated.
4. Exact-head audit, tests, typecheck, CLI, benchmarks, production build, CSP browser smoke, production diagnostics, and security review pass.
5. Apply only absent reviewed Phase 10A3 migrations to the ScopeForge Supabase project, never Job Command Center.
6. Re-run targeted ACL/schema queries and Security Advisor.
7. Configure `GITHUB_APP_WEBHOOK_SECRET` through a supported secret-management surface without exposing it.
8. Configure webhook URL `https://scopeforge.dev/api/integrations/github/webhook`.
9. Verify signed GitHub `ping` over TLS.
10. Subscribe only to the handled event families required by the design.
11. Canary one connected public repository default-branch push and prove one automatic scan chain.
12. Prove rapid-push coalescing and no-lost-latest-head behavior.
13. Prove duplicate delivery and repository-access-removal behavior.
14. After Phase 10A2 private runtime acceptance, canary one private automatic scan separately.
15. Confirm no webhook/provider secret-bearing material reaches browser state, webhook rows, audit rows, logs, redirects, worker contracts, snapshots, or findings.

## Explicitly out of scope

Phase 10A3 does not add:

- pull-request scanning
- GitHub Checks/status writes
- repository write permissions
- issue/comment creation
- automatic repository import/workspace creation
- generic GitHub API worker access
- polling as normal event source
- arbitrary webhook event execution
- repository code execution
- package installation/build/test execution
- deployment discovery or DAST authorization
- automatic hosted runtime activation

## Success criteria

Phase 10A3 succeeds when a connected repository with automatic scanning enabled receives legitimate GitHub default-branch pushes and ScopeForge safely converges on scanning the newest authoritative head exactly once per effective state, while replayed/stale deliveries are harmless, rapid pushes coalesce without losing the latest commit, installation/repository lifecycle changes fail closed, automatic scans are system-authorized rather than browser-user impersonation, public/private execution classes remain isolated, runtime gates remain authoritative, and no webhook/provider credential material crosses into browser, persistence, worker, snapshot, or finding surfaces.