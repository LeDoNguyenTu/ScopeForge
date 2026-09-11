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
- `R2_ACCOUNT_ID` - Cloudflare account identifier for private repository snapshot storage.
- `R2_ACCESS_KEY_ID` - server-only R2 signing access key.
- `R2_SECRET_ACCESS_KEY` - server-only R2 signing secret.
- `R2_BUCKET_NAME` - private repository artifact bucket name.

Never prefix a server-only value with `NEXT_PUBLIC_`. Never expose a Supabase secret key, R2 credential, Turnstile secret, worker credential, GitHub App private key, GitHub installation token, presigned artifact URL, private archive lease URL, or environment dump to browser code or logs.

## Repository artifact storage

Phase 6B repository snapshot acquisition requires the four R2 variables before the hosted snapshot path is enabled in production. The bucket must remain private. Long-lived R2 credentials stay in trusted server composition and are used only to mint short-lived attempt-scoped authorizations or perform trusted object lifecycle operations.

A Vercel deployment may build without R2 credentials when no code path invokes repository artifact storage, but production repository snapshot requests must not be considered operational until private R2 storage and the corresponding worker runtime are configured and verified.

## Private GitHub repository acquisition

Phase 10A2 uses a dedicated hosted capability flag:

- `HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`

This flag is server-only and default-off. The runtime is enabled only when the value is exactly `true`.

Do not reuse `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED` to authorize private acquisition. The public and private acquisition classes are separate security boundaries.

GitHub App credentials and repository installation tokens belong only in the trusted control plane. They must never be configured on the repository snapshot worker host. A private worker receives only the short-lived attempt-bound archive capability produced after the control plane revalidates the claimed linked repository.

Production activation requires an explicit private-acquisition canary and rollback window. Confirm the selected private repository is readable with the intended GitHub App installation, verify the exact Phase 10A2 Supabase migrations/RPC ACLs, verify the private worker deployment and containment, then enable the private runtime flag only for the accepted canary environment. Keep the flag false or absent otherwise.

## Worker runtime

Worker supervisors are a separate runtime boundary from the Vercel application. Worker identity credentials, supervisor endpoint configuration, Podman configuration, and immutable scanner image references belong only on the worker host. They are not browser variables and should not be copied into the Vercel client environment.

Phase 6C hosted repository scanning remains disabled until a real production Linux worker proves the rootless Podman and cgroup v2 acceptance requirements, including zero executor egress, read-only mounts, resource controls, bounded output and scratch space, and cancellation that terminates the underlying container.

Private GitHub snapshot workers remain a separate network-enabled execution class. They do not authorize generic target egress or repository scan egress and do not receive provider credentials.

## Environment consistency

Production public and server Supabase values must refer to the same dedicated ScopeForge project. Do not mix credentials from another application or Supabase project.

Secrets must be configured through the hosting or worker platform's encrypted environment management and must never be committed to the repository.
