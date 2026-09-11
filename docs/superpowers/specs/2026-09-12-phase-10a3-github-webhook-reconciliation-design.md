# Phase 10A3 GitHub Webhook Reconciliation Design

Status: approved in chat on 2026-09-12
Date: 2026-09-12
Stacked baseline: Phase 10A2 reconciliation head `e812a236f3782059e72a5fd2793d4f9b2641e81f`
Target integration order: Phase 10A1 -> Phase 10A2 -> Phase 10A3

## Goal

Phase 10A3 turns connected GitHub projects from a manual one-click scan workflow into a continuously reconciled workflow driven by authenticated GitHub App webhooks.

The target user experience is:

```text
Connect GitHub
  -> select repository
  -> verified ScopeForge project
  -> initial manual scan remains available
  -> default-branch push occurs
  -> ScopeForge verifies the webhook and repository state
  -> latest eligible commit is queued through the existing public or private snapshot class
  -> immutable snapshot
  -> existing zero-egress repository scan
  -> findings refresh
```

Phase 10A3 does not weaken any Phase 10A1 or Phase 10A2 provider, credential, worker, snapshot, or runtime boundary.

## Core design decision

Use GitHub App webhooks as the event source. Do not add provider polling as the primary mechanism.

Reasons:

- near-real-time updates without scheduled GitHub API polling
- lower provider API usage
- native installation and repository lifecycle signals
- replay-safe delivery IDs
- clean separation between provider event ingestion and the existing scan pipeline

Polling may be added later only as a repair mechanism for missed webhook state, not as the Phase 10A3 normal path.

Phase 10A3 also intentionally does not add pull-request checks, status annotations, or repository write permissions. Those are a separate follow-up because they require a wider product and GitHub permission surface.

## Webhook endpoint

Add one public server endpoint:

```text
POST /api/integrations/github/webhook
```

The route is unauthenticated at the browser/session layer because GitHub is the caller. Its trust boundary is the GitHub webhook HMAC signature plus subsequent provider and database revalidation.

The route accepts only `POST`. Other methods remain unsupported.

The route must return bounded responses and never echo raw webhook payloads, provider bodies, signatures, or secret material.

## Server-only webhook secret

Add one new server-only setting:

```text
GITHUB_APP_WEBHOOK_SECRET
```

Requirements:

- separate from `GITHUB_APP_CLIENT_SECRET`
- separate from `GITHUB_APP_STATE_SECRET`
- minimum 32 characters
- maximum 512 characters
- never exposed through `NEXT_PUBLIC_*`
- never included in browser state, logs, audit metadata, error responses, worker tasks, snapshots, or findings

`GitHubAppConfig` gains `webhookSecret` so the GitHub App configuration remains one validated server-only boundary.

## Request size and header validation

The webhook route enforces a hard raw-body ceiling of 10 MiB.

Before JSON processing, validate:

- `content-type` is JSON-compatible
- `x-hub-signature-256` exists and matches `sha256=<64 lowercase or uppercase hex characters>`
- `x-github-delivery` is a valid UUID string
- `x-github-event` is a bounded ASCII token no longer than 64 characters
- request body does not exceed 10 MiB

If `Content-Length` is present and exceeds the limit, reject before reading the full body. The streamed/raw body reader must also enforce the same ceiling so a missing or dishonest header cannot bypass the limit.

Oversized requests return `413` with a bounded generic response.

Malformed headers or payload shape return `400` without persistence.

Invalid signatures return `401` without persistence.

## Signature verification

Verification uses HMAC-SHA256 over the exact raw request bytes and `GITHUB_APP_WEBHOOK_SECRET`.

Implementation requirements:

- compute the expected digest from the untouched raw bytes
- decode both expected and supplied digests into equal-length byte arrays
- use a constant-time comparison such as `crypto.timingSafeEqual`
- never compare secrets using ordinary string equality
- never parse or normalize JSON before signature verification
- never log the supplied or computed signature

Signature failure must occur before any event-specific provider lookup, database mutation, or scan enqueue.

## Supported event set

Phase 10A3 handles only this allowlist:

```text
ping
push
installation
installation_repositories
repository
```

Unknown but correctly signed GitHub events return `202` with an ignored result and do not create delivery records. This avoids retry storms when the App receives events that ScopeForge does not currently use.

### `ping`

Used only for provider setup verification.

A valid signed `ping` returns `200`. It does not create a scan and does not persist the raw payload.

### `push`

Used for continuous scanning.

Only pushes to the repository's authoritative current default branch are eligible. Tag pushes, non-default branches, branch deletion events, and stale default-branch pushes are ignored safely.

### `installation`

Used to reconcile installation suspension/removal state.

Supported actions:

- `suspend`
- `unsuspend`
- `deleted`

`created` does not create a ScopeForge workspace connection because webhook payloads are not a substitute for the owner/admin OAuth/install callback that binds an installation to a ScopeForge workspace and user.

### `installation_repositories`

Used when repository access is added or removed from an existing installation.

Removed repositories become inaccessible for existing ScopeForge links until an authoritative future reconciliation proves access again.

Added repositories do not automatically create new ScopeForge projects. The user must still explicitly import/connect a repository into a workspace.

### `repository`

Used for relevant repository identity/lifecycle changes.

Supported actions are limited to events that can affect a connected link:

- renamed
- transferred
- privatized
- publicized
- archived
- unarchived
- deleted

ScopeForge uses the stable GitHub numeric repository ID as the primary lookup key and then performs authoritative provider revalidation where access still exists.

## Minimal persisted delivery model

Add a private service-only delivery table. Suggested name:

```text
private.github_webhook_deliveries
```

Persist only bounded metadata needed for replay protection, reconciliation state, and operational diagnosis:

- delivery UUID
- event name
- action if applicable
- installation ID if present
- repository ID if present
- event commit SHA for an eligible push if present
- processing state
- bounded result/error code
- received timestamp
- processed timestamp

Do not persist:

- raw webhook JSON
- signature header
- webhook secret
- installation token
- App JWT
- user OAuth token
- authorization headers
- temporary archive URL
- repository source code
- commit messages
- author email/name data from push payloads

The delivery UUID is unique and provides first-line replay protection.

The table has RLS enabled with no browser policy and no direct browser grant. Normal browser roles have no access. `service_role` authority is restricted to the minimum operations required by the trusted webhook service.

## Delivery replay and idempotency

A signed supported webhook delivery is admitted through one atomic service operation.

The delivery UUID is unique. Re-delivery of the same UUID must not repeat repository state mutation or scan enqueue.

For continuous scans, Phase 10A3 also deduplicates by stable repository ID plus immutable commit SHA. A new delivery UUID for a commit already accepted or already represented by the active project scan must not create a duplicate snapshot/scan chain.

The design deliberately distinguishes:

- delivery replay: same `x-github-delivery`
- semantic replay: different delivery ID for the same repository commit
- stale delivery: signed event for an older default-branch head

All three must be safe.

## Push event trust model

Webhook payload repository metadata is a hint, not authority.

For a signed `push` event, ScopeForge reads only the bounded fields required to identify the candidate:

- installation ID
- numeric repository ID
- `ref`
- `after` commit SHA
- deletion flag / zero SHA condition

It does not trust payload `private`, repository URL, owner/name, default branch, or permissions as final authority.

Processing sequence:

1. Verify HMAC over raw bytes.
2. Validate delivery/event headers and JSON shape.
3. Atomically admit the delivery UUID.
4. Load connected ScopeForge repository links by stable repository ID and installation mapping.
5. Require the stored GitHub connection and link to be active and `auto_scan_enabled = true`.
6. Mint a repository-restricted read-only installation token using the stored installation ID.
7. Re-fetch the exact repository from GitHub and verify stable repository ID, canonical URL, visibility, current default branch, and installation access.
8. Fetch the authoritative current default-branch head SHA through the provider client.
9. Require event `ref` to equal `refs/heads/<authoritative-default-branch>`.
10. Require event `after` to be a valid 40-character Git SHA and equal the authoritative current default-branch head SHA.
11. If the event SHA is older than the current default-branch head, record/return a bounded `superseded` result and do not scan it.
12. Reconcile safe repository metadata on the link when provider identity is still valid.
13. Route the repository through the existing public or private project-scan acquisition class based only on authoritative current provider visibility.
14. Apply existing runtime gates. No webhook can bypass a disabled hosted runtime.
15. Persist only bounded delivery outcome metadata.

This model intentionally coalesces rapid pushes. If commits A, B, and C arrive quickly and C is the current provider head when processing occurs, stale A/B events do not create obsolete scans. C is scanned once.

## Default branch changes

A default branch rename/change may arrive through repository metadata before or around a push.

ScopeForge always treats the provider's freshly fetched `default_branch` as authoritative. Stored `github_repository_links.default_branch` is reconciled only after stable repository identity is verified.

A push to the former default branch is ignored once GitHub reports a different current default branch.

## Public/private visibility transitions

Phase 10A3 must preserve Phase 10A1/10A2 execution-class isolation.

If authoritative GitHub metadata says visibility differs from the stored link:

- update safe link metadata only through the trusted reconciliation path
- do not reuse an already queued acquisition class across the visibility transition
- a new eligible scan uses the execution class matching fresh provider visibility
- public acquisition must never receive private authority
- private acquisition must still require `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`

A visibility transition cannot silently broaden worker credentials or network authority.

## Installation state reconciliation

For a signed `installation` event whose installation ID matches a stored ScopeForge connection:

### Suspend

- set connection status to `suspended`
- mark associated repository links `inaccessible`
- do not enqueue new scans
- do not cancel already published immutable snapshots
- queued provider acquisition that has not established fresh claim-time authorization must fail closed through existing authorization checks

### Deleted

- set connection status to `removed`
- mark associated repository links `removed`
- disable automatic scanning for those links
- do not delete historical assets, snapshots, findings, or audit history

### Unsuspend

Do not trust the event alone to reactivate repository links.

- re-fetch installation/repository access using the GitHub App control plane
- set connection back to `active` only when provider access is confirmed
- individually reactivate links only when each repository is still accessible and identity matches
- links no longer in scope remain inaccessible

## Installation repository selection changes

For `installation_repositories`:

- `removed` repository IDs are immediately marked inaccessible for matching links
- `added` repository IDs are provider-revalidated before an existing matching ScopeForge link can become active again
- no webhook-created asset or repository link is allowed
- connection `repository_selection` may be reconciled from authoritative installation metadata when available

## Repository lifecycle reconciliation

Repository events are used only to maintain existing connected links.

For rename/transfer:

- look up by stable numeric repository ID
- re-fetch repository through the stored installation
- verify access still belongs to the installation
- update owner login, repository name, full name, canonical GitHub URL, default branch, and visibility only after provider verification
- update the linked repository asset canonical target atomically with the link to prevent identity drift

For archive/unarchive:

- archive status is not a new database field in Phase 10A3 unless required by implementation evidence
- archived repositories are not automatically scanned from push events
- existing historical results remain readable

For deleted or inaccessible repositories:

- mark the link removed/inaccessible using bounded state
- do not delete historical findings or snapshots

## Automatic scan actor

Webhook scans have no browser user making the request at delivery time.

The existing project-scan pipeline currently records `requested_by` and worker tasks require an actor identity. Phase 10A3 therefore uses the link's original trusted installation/import actor only as an attribution principal, not as fresh user authorization.

The webhook service must not pretend a user session exists.

The preferred database design is to add a dedicated automatic-scan enqueue RPC that:

- accepts the verified workspace/link/repository/commit context from the service-role control plane
- derives the attribution actor from trusted persisted connection/link provenance
- does not require a browser session
- revalidates connection/link/workspace relationships inside the RPC
- reuses the existing public/private snapshot enqueue primitives
- preserves existing project scan intent state and continuation behavior

No browser-callable webhook scan RPC is allowed.

## Runtime gating

Webhook acceptance and scan execution are separate capabilities.

A valid webhook may be accepted and reconciled even when hosted scan runtimes are disabled.

However:

- public source acquisition still requires `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- private source acquisition still requires `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- repository scanning still requires `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`

When the required source runtime is disabled, the delivery records a bounded `runtime_unavailable` outcome and creates no unauthorized task.

Phase 10A3 introduces no new bypass or implicit runtime activation.

## Provider API client changes

Extend the existing server-only GitHub provider client rather than creating a generic webhook-time HTTP client.

Required provider operations are narrowly typed:

- fetch exact installation repository by stable repository ID
- fetch authoritative default-branch head SHA
- fetch installation metadata when reconciling installation status/repository selection

Each method:

- uses existing bounded GitHub request/error handling
- never returns raw provider response bodies to callers
- uses repository-scoped read-only installation credentials when repository access is needed
- never exposes token material beyond the trusted control-plane call

No generic arbitrary GitHub API URL method is added.

## Error model

Webhook responses and persisted outcomes use bounded codes.

Representative codes:

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

Raw GitHub error bodies, signatures, webhook payloads, temporary URLs, and credentials must never become error messages.

For correctly signed deliveries, transient internal/provider failure may return a retryable `5xx` so GitHub can redeliver. Replayed deliveries must remain idempotent.

Permanent ignored/ineligible states return `2xx` to prevent useless provider retries.

## Database/RPC security

All Phase 10A3 schema changes are forward-only and stacked after Phase 10A2.

Any new `SECURITY DEFINER` function:

- sets `search_path = ''`
- fully qualifies all database objects
- validates non-null IDs and expected relationships
- uses stable repository ID plus workspace/link/installation constraints
- takes advisory/row locks where duplicate deliveries or concurrent repository events could race
- revokes default execution from `PUBLIC`, `anon`, and `authenticated`
- grants only the minimum intended `service_role` execution

No raw webhook payload column is permitted.

No token, secret, signature, authorization header, archive capability, or source blob is permitted in Phase 10A3 event tables.

## Logging and privacy

Allowed operational log fields:

- delivery UUID
- event name
- bounded action
- installation ID
- repository ID
- ScopeForge link/task IDs
- bounded result/error code
- duration

Do not log:

- request body
- commit messages
- push author details
- sender payload
- signature header
- webhook secret
- provider token
- raw provider body
- temporary private archive URL

Repository source privacy boundaries from Phase 10A2 remain unchanged.

## UI behavior

Phase 10A3 does not require a new dashboard architecture.

Existing connected-project UI gains truthful automatic-scan status:

- `Automatic scanning on` when `auto_scan_enabled` is true
- latest accepted automatic event/scan state when useful
- manual `Scan project` remains available
- if provider access is suspended/removed, the panel shows the existing inactive/access state rather than pretending automatic scanning is healthy

No webhook delivery payload is exposed to the browser.

A later bounded follow-up may add an owner/admin toggle for `auto_scan_enabled` if the existing UI does not already expose it. The Phase 10A3 webhook service must honor the persisted flag from day one.

## Testing strategy

Implementation follows TDD and must preserve evidence of RED before GREEN for each security-sensitive boundary.

Required tests include:

1. configuration requires a separate valid `GITHUB_APP_WEBHOOK_SECRET`
2. valid HMAC-SHA256 signature succeeds over exact raw bytes
3. altered body with old signature fails
4. malformed/missing signature fails before persistence/provider calls
5. constant-time digest comparison path is used
6. oversized body is rejected by both content-length and streamed byte ceiling
7. invalid delivery UUID/event header is rejected
8. duplicate delivery UUID does not repeat side effects
9. unsupported signed event is ignored without persistence
10. valid `ping` succeeds without scan creation
11. push to tag/non-default branch is ignored
12. branch deletion/zero SHA is ignored
13. stale default-branch push is superseded after authoritative head re-fetch
14. current default-branch head push is accepted
15. different delivery IDs for same repository/commit do not create duplicate scan chains
16. disconnected repository push creates no scan
17. `auto_scan_enabled = false` creates no scan
18. inactive/suspended/removed connection or link creates no scan
19. payload visibility/URL/default branch cannot override authoritative provider metadata
20. public repository routes only to the public snapshot class
21. private repository routes only to the private snapshot class
22. visibility transition never reuses the wrong acquisition class
23. disabled public/private/scan runtime gates remain fail-closed
24. installation suspend marks connection/links inactive without deleting history
25. installation delete marks connection/links removed and disables autoscan
26. unsuspend requires provider revalidation before reactivation
27. installation repository removal marks matching links inaccessible
28. added repository event cannot create a new ScopeForge asset/link
29. repository rename/transfer updates link and asset identity atomically after provider verification
30. repository deletion does not delete findings/snapshot history
31. webhook scan path requires no browser session
32. webhook scan attribution is derived only from trusted persisted provenance
33. new event tables contain no raw payload/secret/token/archive URL columns
34. all new privileged RPCs remain service-role-only with pinned search path
35. logs/results contain no signature, secret, token, raw payload, raw provider body, or private archive capability
36. existing manual public and private scan tests remain green
37. Phase 10C admin, strict CSP, V5/dashboard, worker authorization, repository scan, runtime worker, and scanner regression suites remain green

## Release and operational gates

Phase 10A3 is stacked and cannot release ahead of Phase 10A1 or Phase 10A2.

Before release:

1. Phase 10A1 live GitHub provider canary must pass and Phase 10A1 must release safely.
2. Phase 10A2 private acquisition schema/provider/runtime canary must satisfy its own release gates before any Phase 10A3 private automatic scan is authorized.
3. Phase 10A3 must be reconciled onto the final released predecessor base and fully revalidated.
4. Exact-head tests, audit, typecheck, CLI, benchmarks, Next.js build, CSP browser smoke, production diagnostics, and changed-file security review must pass.
5. Apply only absent reviewed Phase 10A3 migrations to the ScopeForge Supabase project, never the Job Command Center project.
6. Re-run targeted ACL/schema queries and Supabase Security Advisor after migration.
7. Configure `GITHUB_APP_WEBHOOK_SECRET` through a supported secret-management surface without exposing its value.
8. Set the GitHub App webhook URL to `https://scopeforge.dev/api/integrations/github/webhook`.
9. Verify webhook SSL delivery and signed `ping` acceptance.
10. Verify the App subscribes only to the events Phase 10A3 handles, plus any already-required App events.
11. Run a canary default-branch push on an explicitly connected public repository and prove one automatic scan chain.
12. After Phase 10A2 is operationally released, run a separate private repository automatic-scan canary before enabling that path broadly.
13. Prove duplicate/redelivery behavior and repository access removal behavior during canary.
14. Confirm no webhook secret/signature/raw payload/provider credential appears in browser state, database event rows, audit rows, redirects, ordinary logs, worker contracts, or findings.
15. Keep unrelated hosted worker capability flags independently gated.

## Explicitly out of scope

Phase 10A3 does not add:

- pull request scanning
- GitHub Checks API annotations
- commit status writes
- repository write permissions
- issue/comment creation
- automatic repository import from webhook events
- automatic workspace creation
- generic GitHub API worker access
- polling as the normal event source
- arbitrary webhook event execution
- repository code execution
- package installation/build/test execution
- deployment discovery or DAST authorization
- generic target scanning triggered from untrusted webhook fields
- automatic production runtime activation

## Success criteria

Phase 10A3 succeeds when a connected repository with automatic scanning enabled can receive a legitimate GitHub default-branch push and ScopeForge safely turns only the current authoritative head into one existing project-scan chain, while duplicate/stale deliveries coalesce, repository/install lifecycle changes reconcile fail-closed, public/private acquisition classes remain isolated, runtime gates remain authoritative, and no webhook or provider credential material crosses into browser, persistence, worker, snapshot, or finding surfaces.