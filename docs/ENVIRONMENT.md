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

Never prefix a server-only value with `NEXT_PUBLIC_`. Never expose a Supabase secret key, R2 credential, Turnstile secret, worker credential, presigned artifact URL, or environment dump to browser code or logs.

## Repository artifact storage

Phase 6B repository snapshot acquisition requires the four R2 variables before the hosted snapshot path is enabled in production. The bucket must remain private. Long-lived R2 credentials stay in trusted server composition and are used only to mint short-lived attempt-scoped authorizations or perform trusted object lifecycle operations.

A Vercel deployment may build without R2 credentials when no code path invokes repository artifact storage, but production repository snapshot requests must not be considered operational until private R2 storage and the corresponding worker runtime are configured and verified.

## Worker runtime

Worker supervisors are a separate runtime boundary from the Vercel application. Worker identity credentials, supervisor endpoint configuration, Podman configuration, and immutable scanner image references belong only on the worker host. They are not browser variables and should not be copied into the Vercel client environment.

Phase 6C hosted repository scanning remains disabled until a real production Linux worker proves the rootless Podman and cgroup v2 acceptance requirements, including zero executor egress, read-only mounts, resource controls, bounded output and scratch space, and cancellation that terminates the underlying container.

## Environment consistency

Production public and server Supabase values must refer to the same dedicated ScopeForge project. Do not mix credentials from another application or Supabase project.

Secrets must be configured through the hosting or worker platform's encrypted environment management and must never be committed to the repository.
