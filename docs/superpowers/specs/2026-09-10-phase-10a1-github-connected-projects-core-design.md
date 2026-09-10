# Phase 10A1 GitHub Connected Projects Core Design

Status: approved by user on 2026-09-10
Date: 2026-09-10
Branch baseline: `afc99eb92da6b4cb84bc994f2fb66a983a941626`

## Goal

Phase 10A1 turns the existing repository security primitives into a low-friction connected-project workflow:

```text
Connect GitHub
  -> validate GitHub App installation ownership
  -> list repositories available to that installation
  -> select repository
  -> create or reuse a ScopeForge repository asset
  -> mark repository control as verified by the trusted GitHub installation
  -> link the GitHub repository to the asset
  -> request a private immutable source snapshot when hosted acquisition is operationally enabled
  -> automatically continue from a successful snapshot into the existing hosted repository scan when hosted scanning is operationally enabled
  -> show one project-level state to the user instead of exposing snapshot/worker internals
```

The feature must preserve the current authorization, strict CSP, worker isolation, runtime capability gates, and immutable snapshot architecture.

## Why this phase exists

ScopeForge already contains the expensive security machinery:

- repository assets
- public GitHub immutable snapshot acquisition
- isolated repository scanning
- normalized findings and evidence publication
- worker leases, retries, cancellation, and audit boundaries

The current product still requires users to manually register a repository and then understand separate snapshot and scan actions. Repository proof-of-control is explicitly deferred in the current UI. Phase 10A1 adds the missing integration and orchestration layer.

## Scope decomposition

The larger Aikido-style direction is split deliberately so each security boundary can be reviewed independently.

### Phase 10A1 - this design

- GitHub App connection and callback validation
- installation ownership proof using GitHub user authorization during setup
- repository discovery and picker
- repository asset creation or reuse
- GitHub-installation repository proof-of-control
- repository-to-asset linkage
- one project-level scan request
- automatic continuation from successful repository snapshot publication to repository scan enqueue
- safe default-off runtime capability configuration
- project-level read model and UI
- complete tests, documentation, and release-state evidence

### Phase 10A2 - next independent design

Private repository acquisition through a new GitHub-App worker execution class. It must not widen `repository_snapshot_github_public_v1`. A short-lived repository-scoped installation token will be minted for an exact worker attempt and never persisted in browser-visible storage.

### Phase 10A3 - next independent design

Continuous scanning from verified GitHub webhooks, including installation lifecycle, repository-selection changes, and debounced default-branch push rescans.

### Phase 10B - later independent design

Deployment discovery and repository-to-runtime association using trustworthy deployment/provider evidence. Active runtime testing remains behind explicit ownership and authorization controls. README URLs or arbitrary source strings never authorize DAST.

## Existing invariants

Phase 10A1 inherits the current production rules:

- current `main` is the only integration baseline
- accepted public and authenticated presentation must remain intact unless explicitly changed for the connected-project surface
- strict nonce CSP remains enforced
- browser security headers remain enforced
- deployed Supabase migrations are immutable; all database changes are forward-only
- RLS and trusted service boundaries remain authoritative
- worker credentials never become browser credentials
- source repositories are hostile input even after installation ownership is proven
- hosted runtime capability must remain disabled until independent operational acceptance authorizes it
- provider state is never inferred from repository source
- no AI co-author attribution

## GitHub App model

Phase 10A1 uses a GitHub App rather than Personal Access Tokens.

The application requests the smallest useful read-only repository permissions. V1 requires repository metadata and contents read access. No repository write permission is required.

GitHub App configuration remains external provider state. ScopeForge source reads configuration from server-only environment variables:

- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_STATE_SECRET`

A later webhook phase will add `GITHUB_APP_WEBHOOK_SECRET` when webhook processing is implemented.

No private key, client secret, state secret, installation access token, or user access token is exposed through a `NEXT_PUBLIC_` variable or persisted in a browser-readable table.

## Connection flow

### Start

An authenticated workspace owner or admin chooses `Connect GitHub`.

The server:

1. resolves the current ScopeForge user and workspace
2. requires owner/admin role
3. creates a random nonce
4. creates an expiring signed state envelope containing only the minimum identifiers required to bind the callback to the current user and workspace
5. stores the state in an HttpOnly, Secure, SameSite=Lax cookie
6. redirects to the configured GitHub App installation/authorization flow

The signed state expires after 10 minutes and is single-session scoped. The callback rejects mismatched, expired, malformed, or replay-incompatible state.

### Callback ownership proof

The callback never trusts the `installation_id` query parameter by itself.

It:

1. validates the signed state and current Supabase user
2. requires the current user to still be owner/admin in the same workspace
3. exchanges the GitHub OAuth `code` using server-only client credentials
4. uses the temporary GitHub user access token to request installations/repositories available to that GitHub user
5. requires the claimed installation to be present in that authenticated result
6. records safe installation/account metadata
7. discards the user access token immediately after validation
8. clears the state cookie

The user access token is never stored in Supabase, logs, audit metadata, cookies, or application configuration.

## GitHub App authentication utilities

ScopeForge implements GitHub App JWT signing with Node `crypto` rather than adding a broad third-party authentication dependency.

The app JWT:

- uses RS256
- uses the configured App ID as issuer
- sets `iat` slightly before current time to tolerate clock skew
- expires in no more than 10 minutes

Installation access tokens are requested server-side and treated as ephemeral secrets. Phase 10A1 repository discovery may mint an installation token for the installation. Token responses are held in process memory only and never written to logs or database rows.

## Database model

### `public.github_connections`

Safe workspace-visible connection metadata:

- `id uuid primary key`
- `workspace_id uuid not null unique`
- `installation_id bigint not null unique`
- `account_id bigint not null`
- `account_login text not null`
- `account_type text not null`
- `repository_selection text not null`
- `status text not null`
- `installed_by uuid not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Allowed `status` values in 10A1: `active`, `suspended`, `removed`.

Allowed repository selection values: `all`, `selected`.

The one-connection-per-workspace V1 constraint is intentional. It keeps tenant ownership and repository selection unambiguous. Multi-installation workspaces can be designed later if demanded.

### `public.github_repository_links`

Safe repository-to-asset metadata:

- `id uuid primary key`
- `workspace_id uuid not null`
- `github_connection_id uuid not null`
- `asset_id uuid not null unique`
- `repository_id bigint not null`
- `owner_login text not null`
- `repository_name text not null`
- `full_name text not null`
- `default_branch text not null`
- `is_private boolean not null`
- `html_url text not null`
- `auto_scan_enabled boolean not null default true`
- `access_status text not null default 'active'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Unique `(workspace_id, repository_id)` prevents duplicate project imports.

RLS is enabled on both tables. Authenticated workspace members may select rows in their workspace. Browser roles receive no direct INSERT, UPDATE, or DELETE authority. Mutations are performed only through trusted server code after authorization and GitHub-side validation.

## Repository discovery

Repository discovery occurs server-side.

The browser receives only safe repository metadata needed for selection:

- GitHub repository ID
- owner/name
- repository visibility
- default branch
- HTML URL

Before linking a repository, the server fetches or revalidates the repository through the installation. Browser-supplied repository names, IDs, visibility flags, or URLs are never treated as authority.

Pagination is bounded and explicit. The UI can request additional pages, but each page is fetched through the trusted server integration rather than directly from GitHub with a browser token.

## Repository import and proof-of-control

Selecting a repository performs one server-side transaction-like workflow:

1. revalidate current user and workspace role
2. load the active GitHub connection
3. re-fetch the selected GitHub repository through the installation
4. canonicalize the repository target to `https://github.com/<owner>/<repository>`
5. create the repository asset if absent, or reuse the exact existing workspace asset if present
6. write/update the GitHub repository link
7. mark the repository asset `verified`
8. set `verified_by` to the current ScopeForge user and `verified_at` to current time
9. emit bounded audit events without credentials or token material

GitHub App installation access is considered proof that the authenticated user has authorized ScopeForge to read that repository. It is therefore a valid repository-specific proof-of-control mechanism, unlike an arbitrary pasted repository URL.

A repository that is removed from the installation loses integration access. Phase 10A3 webhook reconciliation will update this automatically. Until 10A3, a fresh repository operation must fail closed if GitHub no longer returns the repository for that installation.

## Public versus private repositories in 10A1

Phase 10A1 may link both public and private repositories as projects because the GitHub App can prove control and display safe metadata.

Actual hosted source acquisition remains restricted by the existing Phase 6B execution class. Therefore:

- a linked public repository can use the existing hosted snapshot path once that runtime is operationally enabled
- a linked private repository is displayed as connected but hosted scanning reports that private repository acquisition requires Phase 10A2

The product must never silently downgrade a private repository to unauthenticated public acquisition.

## Project-level scan orchestration

The user should not need to understand `repository_source_snapshots`, worker tasks, or repository scan runs.

A project-level `Scan project` server action:

1. validates user/workspace/project authorization
2. revalidates that the GitHub repository remains accessible through the connection
3. rejects private repositories with a specific Phase 10A2-required state
4. if hosted snapshot runtime is disabled, returns a truthful `HOSTED_SNAPSHOT_RUNTIME_UNAVAILABLE` state
5. if enabled, enqueues the existing repository snapshot request
6. records the project scan intent so successful snapshot publication can continue automatically

### Automatic continuation

After a successful repository snapshot is published at the trusted worker finalization boundary, ScopeForge checks whether the associated project has an active auto-scan intent.

If hosted repository scanning is operationally enabled, it enqueues the existing Phase 6C repository scan for the newly published snapshot. If scan runtime is disabled, it records a truthful waiting state rather than failing or bypassing the gate.

Continuation is idempotent. Replayed worker finalization must not create duplicate repository scans.

## Runtime capability configuration

Current source contains hard-coded `false` repository snapshot/scan gates. Phase 10A1 replaces them with one strict server-only boolean parser:

- only the exact string `true` enables a capability
- missing, empty, or any other value is false
- capability values are evaluated only on the server

The same existing names remain authoritative:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`

Changing source from hard-coded false to default-off environment parsing does not authorize production enablement. Production values must remain false/absent until the independent Phase 6B/6C operational canary and rollback gates are completed and directly verified.

## UI

The existing manual asset flow remains available for web applications, APIs, and users who deliberately register a repository URL.

The repository-first path is elevated:

- `/dashboard/assets/new` gains a prominent `Connect GitHub` / `Import from GitHub` entry
- a dedicated GitHub integration page shows connection status and repository selection
- repository cards show public/private status, default branch, connection state, and scan readiness
- a linked repository routes to the existing asset detail surface with project-level scan state

The UI must not claim that a scan is running when capability runtime is disabled.

Private repositories must show `Connected - private scanning requires the private acquisition worker` until Phase 10A2 ships.

## Error handling

Externally derived errors are mapped to bounded product codes. GitHub response bodies, OAuth tokens, installation tokens, private keys, client secrets, and signed state values are never returned to browsers or written to audit metadata.

Key states include:

- `GITHUB_APP_NOT_CONFIGURED`
- `GITHUB_CONNECTION_ACCESS_DENIED`
- `GITHUB_STATE_INVALID`
- `GITHUB_OAUTH_EXCHANGE_FAILED`
- `GITHUB_INSTALLATION_NOT_AUTHORIZED`
- `GITHUB_INSTALLATION_UNAVAILABLE`
- `GITHUB_REPOSITORY_NOT_ACCESSIBLE`
- `GITHUB_REPOSITORY_ALREADY_LINKED`
- `PRIVATE_REPOSITORY_HOSTED_SCAN_UNAVAILABLE`
- `HOSTED_SNAPSHOT_RUNTIME_UNAVAILABLE`
- `HOSTED_REPOSITORY_SCAN_RUNTIME_UNAVAILABLE`

Network calls use explicit timeouts and bounded response parsing.

## Audit model

The following audit events are safe to record:

- `github.connection.created`
- `github.connection.updated`
- `github.repository.linked`
- `github.repository.access_denied`
- `repository.project_scan_requested`
- `repository.project_scan_waiting_for_runtime`
- `repository.project_scan_continued`

Metadata may contain installation ID, GitHub repository ID, public repository identity, asset ID, and non-secret status codes. It must never contain OAuth codes, access tokens, JWTs, private keys, state secrets, signed state values, or full provider error bodies.

## Security boundaries

Phase 10A1 must prove through tests that:

- callback cannot link an installation based only on `installation_id`
- signed state is user/workspace-bound and expires
- user OAuth token is not persisted
- installation tokens are not persisted
- browser cannot directly mutate connection/link rows
- repository link cannot cross workspaces
- selected repository metadata is re-fetched server-side
- private repositories cannot enter the old public acquisition path
- runtime remains disabled by default
- snapshot-to-scan continuation is idempotent
- worker finalization replay cannot duplicate the next scan
- no token-like values appear in audit metadata
- current CSP and existing dashboard authorization tests remain green

## Operational unfinished work carried into this phase

A fresh 2026-09-10 audit established:

- no open ScopeForge implementation PRs
- no open ScopeForge issues
- current production `main` is `afc99eb92da6b4cb84bc994f2fb66a983a941626`
- current ScopeForge Vercel production deployment is READY on that exact SHA
- Vercel reports no runtime error clusters in the inspected 24-hour window
- Supabase Security Advisor still reports leaked-password protection disabled
- the currently exposed Supabase connector does not provide the Auth setting mutation needed to enable leaked-password protection
- the currently exposed Vercel connector does not provide environment-variable value inspection/mutation
- the currently exposed GitHub connector does not provide a genuine delete-ref branch operation

Those limitations must be documented rather than papered over. They do not block implementation of the default-off connected-project capability.

## Release gates

Phase 10A1 is not complete until all applicable gates pass on the exact candidate SHA:

1. targeted RED/GREEN TDD evidence for each behavior
2. full Vitest suite
3. TypeScript typecheck
4. CLI build/version gate
5. scanner benchmark and matrix gate
6. production Next.js build
7. Supabase migration/security-advisor review if schema is deployed
8. Vercel Preview READY on exact candidate
9. browser acceptance covering GitHub-connected UI without regressing the accepted main presentation or CSP
10. full changed-file security review
11. protected exact-head merge
12. independent post-merge main validation
13. exact production deployment verification

No hosted repository capability flag is enabled as part of this release unless its separate operational canary has independently passed and direct provider configuration evidence is available.

## Success criteria

Phase 10A1 succeeds when an authorized user can connect the ScopeForge GitHub App, safely prove installation ownership, browse repositories, import a repository into ScopeForge without manually copying its URL, and initiate one project-level scan workflow that uses the existing snapshot and repository scanner machinery when those runtimes are operationally available.

The implementation must remain truthful when runtime is unavailable, preserve the private-repository boundary for Phase 10A2, and leave a complete resumable documentation trail.