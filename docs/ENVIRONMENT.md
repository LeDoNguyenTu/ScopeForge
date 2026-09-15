# Environment Configuration

## Vercel application

Client-safe variables:

- `NEXT_PUBLIC_SITE_URL` - canonical public site URL. Production must use `https://scopeforge.dev`.
- `NEXT_PUBLIC_SUPABASE_URL` - URL for the dedicated ScopeForge Supabase project.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - active publishable key for the same ScopeForge project.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Cloudflare Turnstile site key when bot protection is enabled.

Server-only variables:

- `SUPABASE_SECRET_KEY` - trusted Supabase secret key used only by server-side privileged operations.
- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile verification secret when Turnstile is enabled.
- `HOSTED_GITHUB_INTEGRATION_ENABLED` - exact-`true` release gate for GitHub connected projects. Missing, `false`, or any other value keeps the integration unavailable.
- `GITHUB_APP_ID` - numeric GitHub App ID.
- `GITHUB_APP_CLIENT_ID` - GitHub App OAuth client ID.
- `GITHUB_APP_CLIENT_SECRET` - GitHub App OAuth client secret.
- `GITHUB_APP_PRIVATE_KEY` - GitHub App private key used only by trusted server composition.
- `GITHUB_APP_SLUG` - canonical GitHub App slug used for installation URLs.
- `GITHUB_APP_STATE_SECRET` - independent high-entropy secret for signed connection state.
- `R2_ACCOUNT_ID` - Cloudflare account identifier for private repository snapshot storage.
- `R2_ACCESS_KEY_ID` - server-only R2 signing access key.
- `R2_SECRET_ACCESS_KEY` - server-only R2 signing secret.
- `R2_BUCKET_NAME` - private repository artifact bucket name.

Never prefix a server-only value with `NEXT_PUBLIC_`. Never expose a Supabase secret key, R2 credential, Turnstile secret, worker credential, GitHub App secret/private key/state secret, GitHub OAuth or installation token, webhook secret, signed webhook body, presigned artifact URL, private archive lease URL, or environment dump to browser code or logs.

## GitHub App connected-project configuration

The connected-project control plane uses seven server-only GitHub App settings:

- `GITHUB_APP_ID` - numeric GitHub App identifier.
- `GITHUB_APP_CLIENT_ID` - GitHub App OAuth client ID.
- `GITHUB_APP_CLIENT_SECRET` - GitHub App OAuth client secret.
- `GITHUB_APP_PRIVATE_KEY` - GitHub App private signing key used to mint short-lived App JWTs.
- `GITHUB_APP_SLUG` - canonical GitHub App slug used by the connection flow.
- `GITHUB_APP_STATE_SECRET` - independent secret used for signed, expiring OAuth/setup state.
- `GITHUB_APP_WEBHOOK_SECRET` - independent 32-512 character secret used only for `X-Hub-Signature-256` verification.

All seven values are server-only. Do not reuse the OAuth client secret, private key, state secret, or webhook secret for another purpose. Do not create `NEXT_PUBLIC_` aliases for any of them.

Production GitHub App URLs for the current ScopeForge deployment are:

- homepage: `https://scopeforge.dev`
- setup/callback flow: `https://scopeforge.dev/api/integrations/github/callback`
- webhook endpoint for Phase 10A3: `https://scopeforge.dev/api/integrations/github/webhook`

Repository permissions remain read-only. The connected-project design requires Contents read-only and Metadata read-only; Phase 10A3 does not add repository write, issue/comment, check-run, or generic GitHub API authority.

Phase 10A3 verifies `X-Hub-Signature-256` with HMAC-SHA256 over the untouched raw request bytes before JSON parsing or persistence. The request has a hard 10 MiB raw-body ceiling. The system does not persist the raw webhook body, signature, webhook secret, authorization header, App JWT, OAuth/installation token, temporary archive URL, or source bytes as webhook reconciliation state.

Webhook registration is an operational release action, not an automatic consequence of deploying code. Do not register the production webhook or activate `GITHUB_APP_WEBHOOK_SECRET` until Phase 10A1/10A2 release prerequisites, the reviewed Phase 10A3 migrations, provider configuration, delivery/replay checks, and rollback plan have been accepted.

## Hosted capability flags

Hosted worker capabilities are independent server/worker deployment gates. Keep these false or absent until the corresponding production canary and rollback plan have been accepted:

- `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` - public GitHub repository snapshot acquisition.
- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` - private GitHub repository snapshot acquisition.
- `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED` - hosted zero-egress repository scan continuation.
- `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED` - passive runtime observation workers.
- `HOSTED_ACTIVE_CORS_WORKER_ENABLED` - bounded active CORS validation workers.

Each flag is enabled only when its implementation treats the value as exactly `true`. Do not use one capability flag to authorize another execution class.

Code completion, CI success, schema deployment, or provider configuration alone does not authorize any hosted capability. Each runtime requires its own deployment/containment verification, canary, observability, and rollback acceptance.

## GitHub connected-project release gate

`HOSTED_GITHUB_INTEGRATION_ENABLED` is intentionally independent from GitHub App credential presence. Configuring provider credentials must not expose the integration by itself.

The safe production sequence is:

1. deploy/merge with `HOSTED_GITHUB_INTEGRATION_ENABLED` missing or set to `false`,
2. verify the six server-only GitHub App settings and provider URLs/permissions,
3. set `HOSTED_GITHUB_INTEGRATION_ENABLED=true` deliberately for the authenticated owner/admin provider canary,
4. keep the gate enabled only if installation proof, repository listing/import, persistence and log/browser leakage checks all pass,
5. disable it immediately if provider identity, callback, persistence or leakage acceptance fails.

This gate covers the connect route, callback route, integration dashboard, Add Asset GitHub import entry point, and repository-import server action. Hosted repository snapshot/scan runtime gates remain separate and must stay disabled until their own acceptance is complete.

## Repository artifact storage

Phase 6B repository snapshot acquisition requires the four R2 variables before the hosted snapshot path is enabled in production. The bucket must remain private. Long-lived R2 credentials stay in trusted server composition and are used only to mint short-lived attempt-scoped authorizations or perform trusted object lifecycle operations.

A Vercel deployment may build without R2 credentials when no code path invokes repository artifact storage, but production repository snapshot requests must not be considered operational until private R2 storage and the corresponding worker runtime are configured and verified.

## Private GitHub repository acquisition

Phase 10A2 uses the dedicated `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` capability. It is server-only, default-off, and distinct from the public snapshot runtime.

GitHub App credentials and repository installation tokens belong only in the trusted control plane. They must never be configured on the repository snapshot worker host. A private worker receives only the short-lived attempt-bound archive capability produced after the control plane revalidates the claimed linked repository.

Production activation requires an explicit private-acquisition canary and rollback window. Confirm the selected private repository is readable with the intended GitHub App installation, verify the exact Phase 10A2 Supabase migrations/RPC ACLs, verify the private worker deployment and containment, then enable the private runtime flag only for the accepted canary environment. Keep the flag false or absent otherwise.

## Worker runtime

Worker supervisors are a separate runtime boundary from the Vercel application. Worker identity credentials, supervisor endpoint configuration, Podman configuration, and immutable scanner image references belong only on the worker host. They are not browser variables and should not be copied into the Vercel client environment.

Phase 6C hosted repository scanning remains disabled until a real production Linux worker proves the rootless Podman and cgroup v2 acceptance requirements, including zero executor egress, read-only mounts, resource controls, bounded output and scratch space, and cancellation that terminates the underlying container.

Private GitHub snapshot workers remain a separate network-enabled execution class. They do not authorize generic target egress or repository scan egress and do not receive provider credentials.

## Environment consistency

Production public and server Supabase values must refer to the same dedicated ScopeForge project. Do not mix credentials from another application or Supabase project.

Secrets must be configured through the hosting or worker platform's encrypted environment management and must never be committed to the repository.