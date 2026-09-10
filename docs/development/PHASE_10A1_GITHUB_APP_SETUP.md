# Phase 10A1 GitHub App Provider Setup

Date: 2026-09-10
Status: required external provider configuration for Phase 10A1

## Purpose

ScopeForge uses a GitHub App installation plus a short-lived GitHub user authorization only during connection setup. The user authorization proves that the post-install installation ID belongs to a GitHub installation visible to the authorizing user. The user token is discarded after that proof and is never persisted.

## Required GitHub App settings

Use these provider settings for the Phase 10A1 production integration:

- GitHub App homepage: `https://scopeforge.dev`
- Setup URL: `https://scopeforge.dev/api/integrations/github/callback`
- Callback URL: `https://scopeforge.dev/api/integrations/github/callback`
- Request user authorization (OAuth) during installation: **disabled**
- Webhook: not required for Phase 10A1. Continuous push/install reconciliation is Phase 10A3 and will add a separate webhook secret and event review.
- Repository permissions:
  - Contents: Read-only
  - Metadata: Read-only
- No repository write permissions are required by Phase 10A1.

The two callback uses are intentionally distinguished by request shape:

1. GitHub post-install setup returns `installation_id` plus the signed `state`. ScopeForge treats the installation ID as untrusted, stores it only in a short-lived HttpOnly cookie, re-authorizes the exact ScopeForge user/workspace, and starts GitHub user OAuth.
2. GitHub user OAuth returns `code` plus the same signed `state`. ScopeForge exchanges the code server-side, calls the authenticated-user installation listing, and accepts the pending installation ID only when it appears in that list.

This avoids trusting the setup URL's `installation_id` by itself.

## Required Vercel server environment

Configure these values only in trusted server environments:

- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_STATE_SECRET`

None may use a `NEXT_PUBLIC_` prefix. `NEXT_PUBLIC_SITE_URL` remains the existing client-safe canonical site URL and production must remain `https://scopeforge.dev`.

`GITHUB_APP_STATE_SECRET` should be an independently generated high-entropy secret and must not reuse the App client secret, private key, Supabase key, worker credential, or any existing signing key.

## Cookie boundary

Connection setup uses short-lived cookies scoped to `/api/integrations/github/callback`:

- `scopeforge_github_state`
- `scopeforge_github_installation`

Both are HttpOnly, Secure, SameSite=Lax and expire after 10 minutes. Terminal success and failure responses clear both cookies.

## Stored data

Production database rows store only safe installation/repository metadata such as numeric GitHub IDs, account/repository names, selection mode, visibility, default branch, and canonical GitHub URL.

The following must never be stored in the integration tables, audit metadata, browser state, or logs:

- GitHub App private key
- GitHub App client secret
- signed connection state
- OAuth authorization code
- GitHub user access token
- GitHub installation access token
- future GitHub webhook secret

## Release verification

Before enabling the live Connect GitHub button:

1. Confirm the GitHub App provider settings match this document.
2. Confirm all six server-only environment variables exist in the production deployment.
3. Confirm callback URL wildcard matching is disabled unless there is a separately reviewed reason to enable it.
4. Connect a controlled GitHub account and installation.
5. Attempt a callback with a different valid numeric installation ID and confirm ScopeForge rejects it.
6. Confirm no GitHub user or installation token appears in application logs, database tables, redirects, or browser-readable cookies.
7. Confirm a normal workspace member/viewer cannot start or complete a connection.
8. Keep hosted repository snapshot and scan runtime gates disabled until their independent operational acceptance is complete.
